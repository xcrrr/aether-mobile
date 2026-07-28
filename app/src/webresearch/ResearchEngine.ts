/**
 * Research orchestrator: search the web, read the top sources, and have the
 * on-device model write a cited answer grounded only in those sources.
 *
 * The model call goes through the same serialised `Llama.extract` path the
 * Second Brain uses, so research can never run a completion concurrently with a
 * chat reply (the single-context concurrency invariant holds).
 */
import {
  Citation,
  FetchedSource,
  ProgressSource,
  ResearchProgress,
  ResearchResult,
  SearchResult,
  SearchStatus,
} from './types';
import { Message } from '@/types';
import { searchDuckDuckGo } from './DuckDuckGoSearch';
import { fetchAndClean } from './ContentFetcher';
import { buildGemmaPrompt, stripSpecialTokens } from '@/llm/prompt';
import * as Llama from '@/llm/engine';
import { sanitizeModelText, clampChars, MAX_SOURCES, SEARCH_CANDIDATES } from './safety';

/** Recent turns folded into research so follow-ups keep their context. */
const HISTORY_TURNS = 6;
const HISTORY_CHARS_PER_MSG = 400;

function buildTranscript(history: Message[]): string {
  return history
    .slice(-HISTORY_TURNS)
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${clampChars(sanitizeModelText(m.content), HISTORY_CHARS_PER_MSG)}`)
    .join('\n');
}

/** A rewritten query the model clearly did not follow the instruction for. */
function isUsableQuery(rewritten: string, original: string): boolean {
  if (rewritten.length < 2 || rewritten.length > 200) return false;
  // Small models sometimes answer or comment instead of rewriting.
  if (/^(sure|okay|ok|here|i |the user|as an ai)\b/i.test(rewritten)) return false;
  if (rewritten.toLowerCase() === original.trim().toLowerCase()) return false;
  return true;
}

/**
 * Turn a possibly context-dependent question ("are you sure he died?") into a
 * standalone web search query using the conversation. Falls back to the raw
 * query if the model is unavailable or returns something unusable.
 */
export async function contextualizeQuery(query: string, history: Message[]): Promise<string> {
  const transcript = buildTranscript(history);
  if (!transcript) return query;
  const prompt = buildGemmaPrompt('', [{
    id: 'rewrite', role: 'user', createdAt: 0,
    content:
      'Rewrite the user\'s latest message as a single, self-contained web search ' +
      'query, resolving pronouns and references using the conversation. Output ONLY ' +
      `the query; no quotes, no explanation.\n\nConversation:\n${transcript}\n\n` +
      `Latest message: ${sanitizeModelText(query)}\n\nSearch query:`,
  }]);
  const out = await Llama.extract(prompt, { maxTokens: 48, temperature: 0.1, preempt: true, label: 'research-contextualize' });
  const rewritten = (out ? stripSpecialTokens(out) : '')
    .trim()
    .split('\n')[0]
    .replace(/^["']+|["']+$/g, '')
    .trim();
  return isUsableQuery(rewritten, query) ? rewritten : query;
}

// Capping the answer length is the single biggest research speed-up: token
// generation on a CPU model dominates total latency. ~640 tokens is enough for
// a thorough, well-structured answer.
const ANSWER_MAX_TOKENS = 640;
const ANSWER_TEMPERATURE = 0.3;

/** Per-source content cap *inside the prompt* keeps the whole prompt within
 *  the model context window (the full 2000-char text is still kept for display)
 *  and shortens prefill. */
const PROMPT_CONTENT_CHARS = 1100;

const MSG_NO_RESULTS =
  "I searched the web but nothing came back for that. Try naming the specific thing " +
  "you're after, or a different wording.";
const MSG_BLOCKED =
  'The search engine turned the request away this time — that is on its end, not your ' +
  'question. Waiting a moment and asking again usually works.';
const MSG_OFFLINE =
  "I couldn't reach the web. Check the connection and try again.";
const MSG_ALL_DEAD =
  'I found search results for that, but none of the pages would open — they were ' +
  'unreachable, blocked, or had nothing readable on them.';

function noSourcesMessage(status: SearchStatus, hadCandidates: boolean): string {
  if (status === 'offline') return MSG_OFFLINE;
  if (status === 'blocked') return MSG_BLOCKED;
  return hadCandidates ? MSG_ALL_DEAD : MSG_NO_RESULTS;
}

/** Build the grounded-answer prompt. All web-derived text is sanitised first. */
export function buildResearchPrompt(query: string, sources: FetchedSource[], history: Message[] = []): string {
  const blocks = sources
    .map((s, i) => {
      const title = sanitizeModelText(s.title) || '(untitled)';
      const url = sanitizeModelText(s.url);
      const content = clampChars(sanitizeModelText(s.content), PROMPT_CONTENT_CHARS);
      return `[${i + 1}] ${title} (${url})\n${content}`;
    })
    .join('\n\n');

  const transcript = buildTranscript(history);
  const contextBlock = transcript
    ? `Conversation so far (for context; resolve any references in the question against this):\n${transcript}\n\n`
    : '';

  const instruction =
    'You are a research assistant. Using ONLY the sources below, write a clear, ' +
    'well-structured answer to the question. Format it with markdown: use ## ' +
    'headings for sections, **bold** for key terms, and bullet lists where ' +
    'helpful. Lead with the direct answer, then add detail. If the sources do not ' +
    'contain the answer, say so plainly.\n\n' +
    'Cite your sources inline. Put the source number in square brackets at the end ' +
    `of each sentence it supports, like [1] or [2]. Only use numbers 1 to ${sources.length}. ` +
    'Never cite a source you did not use, and never invent a number.\n\n' +
    contextBlock +
    `Question: ${sanitizeModelText(query)}\n\n` +
    `Sources:\n${blocks}\n\n` +
    'Answer:';

  // Wrap as a Gemma user turn so the model answers (and the stop tokens fire).
  return buildGemmaPrompt('', [{ id: 'research', role: 'user', content: instruction, createdAt: 0 }]);
}

/**
 * Remove citation markers that point at a source that does not exist. The model
 * is asked to cite 1..n and mostly does, but an invented [7] against three
 * sources would render as a reference the user cannot follow.
 */
export function dropUnknownCitations(text: string, sourceCount: number): string {
  return text
    .replace(/\[(\d+)\]/g, (marker, n: string) => {
      const index = Number(n);
      return index >= 1 && index <= sourceCount ? marker : '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1');
}

/** Pull the referenced [n] citations, deduped, in ascending index order. */
export function extractCitations(answer: string, sources: FetchedSource[]): Citation[] {
  const referenced = new Set<number>();
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    const n = Number(m[1]);
    if (n >= 1 && n <= sources.length) referenced.add(n);
  }
  return [...referenced]
    .sort((a, b) => a - b)
    .map((index) => ({ index, url: sources[index - 1].url, title: sources[index - 1].title }));
}

/** How many candidates to read at once. One more than needed absorbs the usual
 *  failure rate without waiting for a second round trip. */
const WAVE = MAX_SOURCES + 2;

/**
 * Read candidates until `target` of them yield real content.
 *
 * `MAX_SOURCES` is a delivery target, not a fetch count. Fetching exactly three
 * and filtering the failures — which is what this used to do — meant any dead
 * page permanently cost the answer a source, so a routine bot-block produced a
 * two-source or one-source answer with no attempt to recover.
 */
async function gatherSources(
  candidates: SearchResult[],
  target: number,
  onSource: (source: ProgressSource) => void,
): Promise<FetchedSource[]> {
  const kept: FetchedSource[] = [];
  for (let i = 0; i < candidates.length && kept.length < target;) {
    const wave = candidates.slice(i, i + WAVE);
    i += wave.length;
    for (const hit of wave) onSource({ url: hit.url, title: hit.title, state: 'reading' });
    const results = await Promise.all(
      wave.map(async (hit) => {
        const fetched = await fetchAndClean(hit.url);
        const alive = fetched.content !== '';
        onSource({
          url: hit.url,
          title: fetched.title || hit.title,
          state: alive ? 'read' : 'failed',
        });
        return alive ? { ...fetched, title: fetched.title || hit.title } : null;
      }),
    );
    for (const r of results) {
      if (r && kept.length < target) kept.push(r);
    }
  }
  return kept;
}

export async function runResearch(
  query: string,
  onProgress: (progress: ResearchProgress) => void,
  history: Message[] = [],
  onAnswer?: (text: string) => void,
): Promise<ResearchResult> {
  // Resolve follow-ups ("are you sure he died?") into a standalone query so the
  // web search actually finds the right thing.
  const searchedQuery = history.length ? await contextualizeQuery(query, history) : query;

  const progress: ResearchProgress = {
    phase: 'searching',
    searchedQuery,
    sources: [],
    read: 0,
    target: MAX_SOURCES,
  };
  const emit = () => onProgress({ ...progress, sources: [...progress.sources] });
  emit();

  const { results: hits, status } = await searchDuckDuckGo(searchedQuery, SEARCH_CANDIDATES);

  progress.phase = 'reading';
  emit();

  // Every source is reported the moment its own fetch resolves, so the UI shows
  // real reads in real time. Nothing is pre-incremented or faked.
  const sources = await gatherSources(hits, MAX_SOURCES, (source) => {
    const at = progress.sources.findIndex((s) => s.url === source.url);
    if (at >= 0) progress.sources[at] = source;
    else progress.sources.push(source);
    progress.read = progress.sources.filter((s) => s.state === 'read').length;
    emit();
  });

  if (sources.length === 0) {
    progress.phase = 'done';
    emit();
    return {
      query,
      searchedQuery,
      sources: [],
      answer: noSourcesMessage(status, hits.length > 0),
      citations: [],
      searchStatus: status,
    };
  }

  progress.phase = 'writing';
  progress.target = sources.length;
  emit();

  const prompt = buildResearchPrompt(query, sources, history);
  // Stream the answer into the bubble as it's written so the user sees progress
  // immediately instead of a blank wait.
  let streamed = '';
  const raw = await Llama.extract(prompt, {
    maxTokens: ANSWER_MAX_TOKENS,
    temperature: ANSWER_TEMPERATURE,
    preempt: true,
    // Unknown markers are dropped while streaming too, so a bad [9] never
    // appears and then silently vanishes when generation finishes.
    onToken: onAnswer
      ? (t) => {
        streamed += t;
        onAnswer(dropUnknownCitations(stripSpecialTokens(streamed).trim(), sources.length));
      }
      : undefined,
    label: 'research-answer',
  });

  progress.phase = 'done';
  emit();

  if (!raw) {
    // Model unavailable/busy; still return the sources we gathered.
    const fallback =
      "I gathered sources but couldn't generate an answer (the model is busy or " +
      'not loaded). The sources are listed below.';
    return { query, searchedQuery, sources, answer: fallback, citations: [], searchStatus: status };
  }

  const clean = dropUnknownCitations(stripSpecialTokens(raw).trim(), sources.length);
  const citations = extractCitations(clean, sources);
  return { query, searchedQuery, sources, answer: clean, citations, searchStatus: status };
}
