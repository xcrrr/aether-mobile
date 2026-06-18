import { Message } from '@/types';
import * as Llama from '@/llm/LlamaService';
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
const MAX_EXTRACT_TOKENS = 256;
const EXTRACT_TEMPERATURE = 0.1;

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
  'Output ONLY a raw JSON array — no prose, no markdown fences. Each item has ' +
  'exactly: "category" (one of: identity, personality, preferences, goals, ' +
  'knowledge, relationships, patterns, emotional, context), "key" (short ' +
  'snake_case id), "value" (the fact, concise), "confidence" (0.0-1.0).\n' +
  'Only include facts clearly stated or strongly implied — never invent. If ' +
  'there is nothing worth remembering, output exactly [].\n\n' +
  'Example conversation:\n' +
  'User: Hey, I run a barber shop called Mitruk here in Warsaw and I want to grow it on Instagram\n' +
  'Example output:\n' +
  '[{"category":"identity","key":"business_name","value":"Mitruk barber shop","confidence":0.95},' +
  '{"category":"identity","key":"location","value":"Warsaw","confidence":0.9},' +
  '{"category":"goals","key":"current_goal","value":"grow the barber shop on Instagram","confidence":0.9}]\n\n' +
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

function buildPrompt(messages: Message[]): string {
  const instruction = PROMPT_TEMPLATE.replace('{CONVERSATION_TEXT}', buildTranscript(messages));
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
 *  none found. */
export function parseEntries(raw: string): unknown[] | null {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(tidyJson(raw.slice(start, end + 1)));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to single-object handling
    }
  }
  // Some small models emit a single bare object instead of an array.
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1)));
      if (obj && typeof obj === 'object') return [obj];
    } catch {
      return null;
    }
  }
  return null;
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
    value: value.trim(),
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
  for (const raw of rawEntries) {
    const entry = validateEntry(raw);
    if (!entry) continue;
    MemoryStore.addOrUpdateEntry({ ...entry, sourceConversationId: conversationId });
    applied += 1;
  }

  MemoryStore.recordExtraction();
  return applied;
}
