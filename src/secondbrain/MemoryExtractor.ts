import { Message } from '@/types';
import * as Llama from '@/llm/engine';
import { buildGemmaPrompt } from '@/llm/prompt';
import { MemoryCategory, MEMORY_CATEGORIES } from './types';
import { MemoryStore } from './MemoryStore';

// Extract after the very first user message — the Second Brain should start
// learning immediately, not wait for a second turn.
const MIN_USER_MESSAGES = 1;
// Keep this small: auto-extraction runs after each reply and is preempted the
// moment the user sends their next message. A short budget lets it finish in the
// gap (a truncated JSON array parses to nothing). Facts are short, so this is
// plenty for a handful of them.
const MAX_EXTRACT_TOKENS = 320;
const EXTRACT_TEMPERATURE = 0.1;

// Don't even run inference on trivial exchanges (greetings, one-word replies).
// This is what stops the brain "fetching on every message" — a plain "hi" never
// reaches the model, so nothing churns and nothing junk gets saved.
const MIN_SUBSTANCE_CHARS = 12;
const GREETING_ONLY = /^(hi+|hey+|hello+|yo+|sup|hiya|howdy|heya|good\s?(morning|evening|afternoon|night)|thanks?|thank\s?you|thx|ty|ok(ay)?|k|cool|nice|great|lol|lmao|test+|yes|yeah|yep|sure|no+|nope|y|n|hmm+|wassup|what'?s\s?up)[\s!.,?]*$/i;

// Only persist genuinely confident facts. Low-confidence guesses are the "random
// bullshit" — drop them so memory stays high-signal.
const MIN_SAVE_CONFIDENCE = 0.7;

/** True only when the user has said something worth analysing. Drops
 *  greeting-only messages first, then requires real content in what's left — so
 *  "hi" / "hey there" never trigger inference, but "i love climbing" does. */
function hasSubstance(userMessages: Message[]): boolean {
  const text = userMessages
    .map((m) => m.content.trim())
    .filter((t) => t && !GREETING_ONLY.test(t))
    .join(' ')
    .trim();
  return text.length >= MIN_SUBSTANCE_CHARS;
}

// Keep the transcript well inside the model context so the extraction completion
// never silently overflows (which would return no result → nothing saved).
const MAX_TRANSCRIPT_CHARS = 4000;
const MAX_MESSAGE_CHARS = 600;

const PROMPT_TEMPLATE =
  'You are a memory-extraction engine for a personal AI assistant. From the ' +
  'conversation, extract durable facts ABOUT THE USER that would help ' +
  'personalize future replies: their name, location, job or business, current ' +
  'projects, skills, preferences, goals, important people, and ongoing ' +
  'situations. Ignore one-off questions, general knowledge, and anything about ' +
  'the assistant.\n\n' +
  'Be strict and minimal: extract ONLY high-value, durable facts. Skip ' +
  'greetings, small talk, pleasantries, and anything trivial or low-confidence. ' +
  'If the conversation contains nothing important about the user, output empty arrays.\n\n' +
  'Output ONLY raw JSON (no prose, no markdown fences) as an object with two keys: ' +
  '"facts" (array; each item has exactly "category", "key", "value", "confidence") and ' +
  '"links" (array; each item has "from_key", "to_key", "relation" — a short relationship ' +
  'between two fact keys, e.g. {"from_key":"business_name","to_key":"city","relation":"located_in"}). ' +
  'Use [] for either when empty. The "category" must be one of: identity, personality, ' +
  'preferences, goals, knowledge, relationships, patterns, emotional, context. ' +
  'Only include facts clearly stated or strongly implied — never invent. ' +
  'Keep each "value" concise (a dozen words max). Reuse an existing key when updating a known fact; do not emit duplicates.\n\n' +
  'ALREADY IN MEMORY (do NOT output any of these again unless the value has ' +
  'genuinely CHANGED; when updating, reuse the EXACT same key shown):\n{KNOWN_FACTS}\n\n' +
  'Example conversation:\n' +
  'User: Hey, I run a barber shop called Mitruk here in Warsaw and I want to grow it on Instagram\n' +
  'Example output:\n' +
  '{"facts":[{"category":"identity","key":"business_name","value":"Mitruk barber shop","confidence":0.95},' +
  '{"category":"identity","key":"city","value":"Warsaw","confidence":0.9},' +
  '{"category":"goals","key":"current_goal","value":"grow the barber shop on Instagram","confidence":0.9}],' +
  '"links":[{"from_key":"business_name","to_key":"city","relation":"located_in"}]}\n\n' +
  'Now extract from this conversation:\n{CONVERSATION_TEXT}\n\nJSON:';

const CATEGORIES = new Set<string>(MEMORY_CATEGORIES);

/**
 * Build a transcript of the most recent messages, capped to `maxChars` (and each
 * message capped individually) so the extraction prompt always fits the context.
 */
export function buildTranscript(messages: Message[], maxChars = MAX_TRANSCRIPT_CHARS): string {
  const lines: string[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const body = m.content.trim().slice(0, MAX_MESSAGE_CHARS);
    const line = `${m.role === 'user' ? 'User' : 'Assistant'}: ${body}`;
    if (total + line.length > maxChars && lines.length > 0) break;
    lines.unshift(line);
    total += line.length + 1;
  }
  return lines.join('\n');
}

// Cap the known-facts list so the extraction prompt stays well inside the context
// window (each fact line is short; the transcript already eats most of the budget).
const MAX_KNOWN_FACTS = 50;

/** A compact list of facts already saved, so the model reuses keys and skips repeats. */
function buildKnownFacts(): string {
  const entries = MemoryStore.getAllEntries();
  if (!entries.length) return '(nothing yet)';
  return entries
    .slice(0, MAX_KNOWN_FACTS)
    .map((e) => `- [${e.category}] ${e.key}: ${e.value}`)
    .join('\n');
}

function buildPrompt(messages: Message[]): string {
  const instruction = PROMPT_TEMPLATE
    .replace('{KNOWN_FACTS}', buildKnownFacts())
    .replace('{CONVERSATION_TEXT}', buildTranscript(messages));
  // Wrap in Gemma turn markers so the model answers the instruction (and emits
  // a closing turn the STOP tokens catch) rather than continuing the text.
  return buildGemmaPrompt('', [
    { id: 'extract', role: 'user', content: instruction, createdAt: 0 },
  ]);
}

/** Drop trailing commas (e.g. `{...},]`) that small models often emit and which
 *  break strict JSON.parse. */
function tidyJson(s: string): string {
  return s.replace(/,\s*([\]}])/g, '$1');
}

/** Extract the JSON entries from a model response, tolerating markdown fences,
 *  stray prose, trailing commas, or a single bare object. Returns `null` if
 *  none found. Accepts the new object form `{ facts: [...], links: [...] }` as
 *  well as the legacy bare-array and single-object forms. */
export function parseEntries(raw: string): unknown[] | null {
  // object form: { facts: [...], links: [...] }
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1)));
      if (obj && typeof obj === 'object' && Array.isArray((obj as { facts?: unknown }).facts)) {
        return (obj as { facts: unknown[] }).facts;
      }
    } catch { /* fall through */ }
  }
  // legacy: bare array
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(tidyJson(raw.slice(start, end + 1)));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  // single bare object (a lone fact)
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1)));
      if (obj && typeof obj === 'object' && !Array.isArray((obj as { facts?: unknown }).facts)) return [obj];
    } catch { return null; }
  }
  return null;
}

export interface ParsedLink { fromKey: string; toKey: string; relation: string; }

/** Pull the optional relationship links from a response object. Returns [] if none. */
export function parseLinks(raw: string): ParsedLink[] {
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart < 0 || objEnd <= objStart) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: { links?: unknown };
  try { obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1))); } catch { return []; }
  const links = Array.isArray(obj?.links) ? obj.links : [];
  const out: ParsedLink[] = [];
  for (const l of links) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = l as any;
    if (link && typeof link.from_key === 'string' && typeof link.to_key === 'string' && typeof link.relation === 'string') {
      out.push({ fromKey: link.from_key, toKey: link.to_key, relation: link.relation });
    }
  }
  return out;
}

interface ValidEntry {
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
}

/** Validate one raw object from the model; returns a normalised entry or null. */
export function validateEntry(obj: unknown): ValidEntry | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const category = o.category;
  const key = o.key;
  const value = o.value;
  const rawConfidence = o.confidence;

  if (typeof category !== 'string' || !CATEGORIES.has(category)) return null;
  if (typeof key !== 'string' || !key.trim()) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const confidence = Math.min(
    1,
    Math.max(0, typeof rawConfidence === 'number' && !Number.isNaN(rawConfidence) ? rawConfidence : 0.5),
  );

  return {
    category: category as MemoryCategory,
    key: key.trim().toLowerCase().replace(/\s+/g, '_'),
    value: value.trim().slice(0, 200),
    confidence,
  };
}

/**
 * Analyse a finished conversation and upsert any extracted facts. Returns the
 * number of facts learned or updated (0 if none).
 *
 * Best-effort. Auto-runs fire-and-forget after each reply (they yield the shared
 * context if it is busy). Pass `{ force: true }` for a manual "Analyze now" — it
 * preempts any in-flight best-effort completion so it never silently no-ops.
 * No-ops when the Second Brain is disabled, the exchange is trivial, or no model
 * is loaded.
 */
export async function extractFromConversation(
  messages: Message[],
  conversationId: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  if (!MemoryStore.isEnabled()) return 0;
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length < MIN_USER_MESSAGES) return 0;
  // Skip trivial exchanges entirely (no inference, no churn). A manual "Analyze
  // now" (force) always runs.
  if (!opts.force && !hasSubstance(userMessages)) return 0;

  let response: string | null;
  try {
    response = await Llama.extract(buildPrompt(messages), {
      maxTokens: MAX_EXTRACT_TOKENS,
      temperature: EXTRACT_TEMPERATURE,
      preempt: opts.force,
    });
  } catch (err) {
    console.error('[MemoryExtractor] inference failed', err);
    return 0;
  }
  if (!response) return 0;

  const rawEntries = parseEntries(response);
  if (!rawEntries) return 0;

  let applied = 0;
  const appliedKeys: string[] = [];
  for (const raw of rawEntries) {
    const entry = validateEntry(raw);
    if (!entry) continue;
    // Drop low-confidence guesses — keep memory high-signal.
    if (entry.confidence < MIN_SAVE_CONFIDENCE) continue;
    MemoryStore.addOrUpdateEntry({ ...entry, sourceConversationId: conversationId });
    appliedKeys.push(entry.key);
    applied += 1;
  }

  const links = parseLinks(response);
  if (links.length) {
    const keys = new Set(MemoryStore.getAllEntries().map((e) => e.key));
    for (const l of links) {
      if (keys.has(l.fromKey) && keys.has(l.toKey)) {
        MemoryStore.addEdge({ fromKey: l.fromKey, toKey: l.toKey, relation: l.relation });
      }
    }
  }

  MemoryStore.recordExtraction();
  MemoryStore.markStale();
  // Light up the just-learned facts in the graph (cleared once the user views them).
  if (appliedKeys.length) MemoryStore.setRecentKeys(appliedKeys);
  return applied;
}
