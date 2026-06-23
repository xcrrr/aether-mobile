/**
 * Research orchestrator: search the web, read the top sources, and have the
 * on-device model write a cited answer grounded only in those sources.
 *
 * The model call goes through the same serialised `Llama.extract` path the
 * Second Brain uses, so research can never run a completion concurrently with a
 * chat reply (the single-context concurrency invariant holds).
 */
import { Citation, FetchedSource, ResearchResult, SearchResult } from './types';
import { Message } from '@/types';
import { searchDuckDuckGo } from './DuckDuckGoSearch';
import { fetchAndClean } from './ContentFetcher';
import { buildGemmaPrompt, stripSpecialTokens } from '@/llm/prompt';
import * as Llama from '@/llm/LlamaService';
import { sanitizeModelText, clampChars, MAX_SOURCES } from './safety';

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

/**
 * Turn a possibly context-dependent question ("are you sure he died?") into a
 * standalone web search query using the conversation. Falls back to the raw
 * query if the model is unavailable or returns nothing useful.
 */
export async function contextualizeQuery(query: string, history: Message[]): Promise<string> {
  const transcript = buildTranscript(history);
  if (!transcript) return query;
  const prompt = buildGemmaPrompt('', [{
    id: 'rewrite', role: 'user', createdAt: 0,
    content:
      'Rewrite the user\'s latest message as a single, self-contained web search ' +
      'query, resolving pronouns and references using the conversation. Output ONLY ' +
      `the query — no quotes, no explanation.\n\nConversation:\n${transcript}\n\n` +
      `Latest message: ${sanitizeModelText(query)}\n\nSearch query:`,
  }]);
  const out = await Llama.extract(prompt, { maxTokens: 48, temperature: 0.1, preempt: true });
  const rewritten = (out ? stripSpecialTokens(out) : '')
    .trim()
    .split('\n')[0]
    .replace(/^["']+|["']+$/g, '')
    .trim();
  return rewritten || query;
}

// Capping the answer length is the single biggest research speed-up: token
// generation on a CPU model dominates total latency. ~640 tokens is enough for
// a thorough, well-structured answer.
const ANSWER_MAX_TOKENS = 640;
const ANSWER_TEMPERATURE = 0.3;

/** Per-source content cap *inside the prompt* — keeps the whole prompt within
 *  the model context window (the full 2000-char text is still kept for display)
 *  and shortens prefill. */
const PROMPT_CONTENT_CHARS = 1100;

const NO_SOURCES_MSG =
  "I couldn't find usable sources for that query. Try rephrasing it, or check " +
  'your internet connection.';

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
    ? `Conversation so far (for context — resolve any references in the question against this):\n${transcript}\n\n`
    : '';

  const instruction =
    'You are a research assistant. Using ONLY the sources below, write a clear, ' +
    'well-structured answer to the question. Format it with markdown: use ## ' +
    'headings for sections, **bold** for key terms, and bullet lists where ' +
    'helpful. Do NOT write citation numbers like [1] in your text. Lead with the ' +
    'direct answer, then add detail. If the sources do not contain the answer, ' +
    'say so plainly.\n\n' +
    contextBlock +
    `Question: ${sanitizeModelText(query)}\n\n` +
    `Sources:\n${blocks}\n\n` +
    'Answer:';

  // Wrap as a Gemma user turn so the model answers (and the stop tokens fire).
  return buildGemmaPrompt('', [{ id: 'research', role: 'user', content: instruction, createdAt: 0 }]);
}

/** Remove inline [n] / [n, m] citation markers and tidy the surrounding spacing. */
export function stripCitationMarkers(text: string): string {
  return text
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, '')
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

export async function runResearch(
  query: string,
  onProgress: (status: string) => void,
  history: Message[] = [],
): Promise<ResearchResult> {
  // Resolve follow-ups ("are you sure he died?") into a standalone query so the
  // web search actually finds the right thing.
  const searchQuery = history.length ? await contextualizeQuery(query, history) : query;

  onProgress('Searching the web…');
  const hits: SearchResult[] = await searchDuckDuckGo(searchQuery, MAX_SOURCES);

  // Report each source the moment its fetch+clean actually resolves, so the
  // "thinking" status counts up in real time. The numbers are real reads — never
  // faked or pre-incremented.
  const total = hits.length;
  let read = 0;
  onProgress(total ? `Found ${total} source${total === 1 ? '' : 's'} — reading 0/${total}…` : 'No sources found…');
  const fetched = await Promise.all(
    hits.map((h) =>
      fetchAndClean(h.url).then((r) => {
        read += 1;
        onProgress(`Reading the web… ${read}/${total} source${total === 1 ? '' : 's'}`);
        return r;
      }),
    ),
  );
  const sources = fetched.filter((s) => s.content !== '');

  if (sources.length === 0) {
    return { query, sources: [], answer: NO_SOURCES_MSG, citations: [] };
  }

  onProgress(`Read ${sources.length} source${sources.length === 1 ? '' : 's'} — writing your answer…`);
  const prompt = buildResearchPrompt(query, sources, history);
  const raw = await Llama.extract(prompt, { maxTokens: ANSWER_MAX_TOKENS, temperature: ANSWER_TEMPERATURE, preempt: true });

  if (!raw) {
    // Model unavailable/busy — still return the sources we gathered.
    const fallback =
      "I gathered sources but couldn't generate an answer (the model is busy or " +
      'not loaded). The sources are listed below.';
    return { query, sources, answer: fallback, citations: [] };
  }

  const clean = stripSpecialTokens(raw).trim();
  const citations = extractCitations(clean, sources);
  // Strip the inline [n] markers from what the user sees — the numbered Sources
  // list below the answer already maps everything.
  const answer = stripCitationMarkers(clean);
  return { query, sources, answer, citations };
}
