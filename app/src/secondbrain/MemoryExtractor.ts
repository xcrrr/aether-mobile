import { Message } from '@/types';
import * as Llama from '@/llm/engine';
import { buildGemmaPrompt } from '@/llm/prompt';
import { MemoryCategory, MEMORY_CATEGORIES } from './types';
import { MemoryStore } from './MemoryStore';
import { groundingScore } from './grounding';
import { useModelStore } from '@/state/useModelStore';

// Extract after the very first user message — the Second Brain should start
// learning immediately, not wait for a second turn.
const MIN_USER_MESSAGES = 1;
// Keep this small: auto-extraction runs after each reply and is preempted the
// moment the user sends their next message. A short budget lets it finish in the
// gap (a truncated JSON array parses to nothing). Facts are short, so this is
// plenty for a handful of them.
const MAX_EXTRACT_TOKENS = 380;
const EXTRACT_TEMPERATURE = 0.1;
const manualExtractions = new Map<string, Promise<number>>();

// Don't even run inference on trivial exchanges (greetings, one-word replies).
// This is what stops the brain "fetching on every message" — a plain "hi" never
// reaches the model, so nothing churns and nothing junk gets saved.
const MIN_SUBSTANCE_CHARS = 12;
const GREETING_ONLY = /^(hi+|hey+|hello+|yo+|sup|hiya|howdy|heya|good\s?(morning|evening|afternoon|night)|thanks?|thank\s?you|thx|ty|ok(ay)?|k|cool|nice|great|lol|lmao|test+|yes|yeah|yep|sure|no+|nope|y|n|hmm+|wassup|what'?s\s?up)[\s!.,?]*$/i;

/** Keep only exchanges whose user turn was sent under the queued Core consent.
 * Assistant turns inherit the eligibility of the user turn they answer. */
export function messagesForConsent(messages: Message[], consentToken: string): Message[] {
  const eligible: Message[] = [];
  let includeExchange = false;
  for (const message of messages) {
    if (message.role === 'user') includeExchange = message.coreConsentToken === consentToken;
    if (includeExchange) eligible.push(message);
  }
  return eligible;
}

/**
 * Per-model conservatism. Both models pass the same grounding gate, so final
 * storage quality is equivalent — the weaker model just saves less per pass.
 * Unknown/missing model falls back to the strictest policy.
 */
export interface ExtractionPolicy {
  minConfidence: number;
  maxFacts: number;
  maxLinks: number;
}
export function extractionPolicy(activeModelId: string | null): ExtractionPolicy {
  if (activeModelId === 'gemma4-e4b') return { minConfidence: 0.7, maxFacts: 5, maxLinks: 3 };
  return { minConfidence: 0.8, maxFacts: 3, maxLinks: 2 };
}

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
  'projects, skills, stable preferences, long-term goals, important people, and ' +
  'ongoing situations. Ignore one-off questions, temporary moods, vague ideas, ' +
  'general knowledge, and anything about the assistant.\n\n' +
  'Be strict and minimal: extract ONLY high-value, durable facts. Skip ' +
  'greetings, small talk, pleasantries, and anything trivial or low-confidence. ' +
  'It is always better to extract nothing than a weak fact. ' +
  'If the conversation contains nothing important about the user, output empty arrays.\n\n' +
  'Output ONLY raw JSON (no prose, no markdown fences) as an object with two keys: ' +
  '"facts" (array; each item has exactly "category", "key", "value", "confidence", "quote") and ' +
  '"links" (array; each item has "from_key", "to_key", "relation" — a short snake_case relationship ' +
  'between two fact keys, e.g. {"from_key":"business_name","to_key":"city","relation":"located_in"}). ' +
  'Use [] for either when empty. The "category" must be one of: identity, personality, ' +
  'preferences, goals, knowledge, relationships, patterns, emotional, context. ' +
  'The "quote" MUST be the user\'s own exact words, copied verbatim from a "User:" line, that state ' +
  'the fact. NEVER quote the assistant, never paraphrase, never invent. A fact without a real user ' +
  'quote must not be output at all. ' +
  'Keep each "value" concise (a dozen words max). Reuse an existing key when updating a known fact; do not emit duplicates.\n\n' +
  'ALREADY IN MEMORY (do NOT output any of these again unless the value has ' +
  'genuinely CHANGED; when updating, reuse the EXACT same key shown):\n{KNOWN_FACTS}\n\n' +
  'Example conversation:\n' +
  'User: Hey, I run a barber shop called Mitruk here in Warsaw and I want to grow it on Instagram\n' +
  'Example output:\n' +
  '{"facts":[{"category":"identity","key":"business_name","value":"Mitruk barber shop","confidence":0.95,"quote":"I run a barber shop called Mitruk"},' +
  '{"category":"identity","key":"city","value":"Warsaw","confidence":0.9,"quote":"a barber shop called Mitruk here in Warsaw"},' +
  '{"category":"goals","key":"current_goal","value":"grow the barber shop on Instagram","confidence":0.9,"quote":"I want to grow it on Instagram"}],' +
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

/** The user's side of the transcript — the ONLY text a fact may be grounded in. */
function userTextOf(messages: Message[]): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim().slice(0, MAX_MESSAGE_CHARS))
    .join('\n');
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
 *  none found. Accepts the object form `{ facts: [...], links: [...] }` as
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

const RELATION_RE = /^[a-z][a-z0-9_]{1,30}$/;

/** Normalise a model relation to snake_case; null when it can't be a sane label. */
function sanitizeRelation(raw: string): string | null {
  const r = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return RELATION_RE.test(r) ? r : null;
}

/** Pull the optional relationship links from a response object. Returns [] if none. */
export function parseLinks(raw: string): ParsedLink[] {
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart < 0 || objEnd <= objStart) return [];
  let obj: { links?: unknown };
  try { obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1))); } catch { return []; }
  const links = Array.isArray(obj?.links) ? obj.links : [];
  const out: ParsedLink[] = [];
  for (const l of links) {
    const link = l as Record<string, unknown>;
    if (!link || typeof link.from_key !== 'string' || typeof link.to_key !== 'string' || typeof link.relation !== 'string') continue;
    const relation = sanitizeRelation(link.relation);
    if (!relation) continue;
    out.push({ fromKey: link.from_key, toKey: link.to_key, relation });
  }
  return out;
}

interface ValidEntry {
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  quote: string;
}

/** Validate one raw object from the model; returns a normalised entry or null.
 *  A fact without a usable quote is invalid — evidence is mandatory. */
export function validateEntry(obj: unknown): ValidEntry | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const category = o.category;
  const key = o.key;
  const value = o.value;
  const quote = o.quote;
  const rawConfidence = o.confidence;

  if (typeof category !== 'string' || !CATEGORIES.has(category)) return null;
  if (typeof key !== 'string' || !key.trim()) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  if (typeof quote !== 'string' || !quote.trim()) return null;
  const confidence = Math.min(
    1,
    Math.max(0, typeof rawConfidence === 'number' && !Number.isNaN(rawConfidence) ? rawConfidence : 0),
  );

  return {
    category: category as MemoryCategory,
    key: key.trim().toLowerCase().replace(/\s+/g, '_'),
    value: value.trim().slice(0, 200),
    confidence,
    quote: quote.trim().slice(0, 300),
  };
}

const CATEGORY_REASON: Record<MemoryCategory, string> = {
  identity: 'You stated this about yourself',
  personality: 'You described yourself this way',
  preferences: 'You expressed this preference yourself',
  goals: 'You stated this as a goal',
  knowledge: 'You described this skill or knowledge yourself',
  relationships: 'You mentioned this person yourself',
  patterns: 'You described this habit yourself',
  emotional: 'You shared this yourself',
  context: 'You described this ongoing situation yourself',
};

const GENERIC_KEY_PARTS = new Set([
  'current', 'main', 'new', 'old', 'preferred', 'primary', 'latest',
  'date', 'schedule', 'status', 'detail', 'info', 'value',
]);

function keyAnchors(key: string): string[] {
  return key
    .split(/[^a-z0-9]+/i)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length >= 4 && !GENERIC_KEY_PARTS.has(part));
}

/**
 * Small models occasionally ignore the prompt's exact-key instruction when a
 * known fact changes (`marathon_date` -> `marathon_schedule`). Reuse the saved
 * key only when one same-category fact shares an explicit distinctive key
 * anchor. Ambiguous or generic keys deliberately remain separate facts.
 */
function canonicalKeyFor(entry: ValidEntry): string {
  const candidateKeys = new Set([
    ...MemoryStore.getAllEntries()
      .filter((fact) => fact.category === entry.category)
      .map((fact) => fact.key),
    ...MemoryStore.getDeletions()
      .filter((deletion) =>
        deletion.category === entry.category || deletion.categoryAliases?.includes(entry.category),
      )
      .map((deletion) => deletion.key),
  ]);
  if (candidateKeys.has(entry.key)) {
    return entry.key;
  }
  const anchors = new Set(keyAnchors(entry.key));
  if (!anchors.size) return entry.key;
  const matches = [...candidateKeys].filter((key) =>
    keyAnchors(key).some((anchor) => anchors.has(anchor)),
  );
  return matches.length === 1 ? matches[0] : entry.key;
}

function matchingDeletionsFor(entry: ValidEntry) {
  const anchors = new Set(keyAnchors(entry.key));
  if (!anchors.size) return [];
  return MemoryStore.getDeletions().filter((deletion) =>
    (deletion.category === entry.category || deletion.categoryAliases?.includes(entry.category)) &&
    keyAnchors(deletion.key).some((anchor) => anchors.has(anchor)),
  );
}

function deletionAuthorityFor(entry: ValidEntry) {
  const exact = MemoryStore.deletionFor(entry.category, entry.key);
  if (exact) return exact;

  const matches = matchingDeletionsFor(entry);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Analyse a finished conversation and upsert any extracted facts. Returns the
 * number of facts learned or updated (0 if none).
 *
 * Every fact must be grounded: its quote has to actually appear in the USER's
 * messages, or it is dropped. Assistant text can never ground a fact, so
 * hallucinations cannot become memories no matter what the model outputs.
 *
 * Best-effort. Auto-runs fire-and-forget after each reply (they yield the shared
 * context if it is busy). Pass `{ force: true }` for a manual "Analyze now" — it
 * preempts any in-flight best-effort completion so it never silently no-ops.
 * No-ops when the Second Brain is disabled, the exchange is trivial, or no model
 * is loaded.
 */
async function runExtraction(
  messages: Message[],
  conversationId: string,
  opts: { force?: boolean; consentToken?: string } = {},
): Promise<number> {
  await MemoryStore.ensureHydrated();
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
      label: 'core-extract',
    });
  } catch (err) {
    console.error('[MemoryExtractor] inference failed', err);
    return 0;
  }
  if (!response) return 0;
  if (!MemoryStore.isEnabled()) return 0;
  if (
    opts.consentToken !== undefined &&
    opts.consentToken !== MemoryStore.extractionConsentToken()
  ) return 0;

  const rawEntries = parseEntries(response);
  if (!rawEntries) return 0;

  const policy = extractionPolicy(useModelStore.getState().activeModelId);
  const userText = userTextOf(messages);

  const grounded: (ValidEntry & { effectiveConfidence: number })[] = [];
  for (const raw of rawEntries) {
    const entry = validateEntry(raw);
    if (!entry) continue;
    const ground = groundingScore(entry.quote, userText);
    if (ground <= 0) continue;
    // The gate is the weaker of the model's confidence and the mechanical
    // grounding — a confident claim with shaky evidence still doesn't save.
    const effectiveConfidence = Math.min(entry.confidence, ground);
    if (effectiveConfidence < policy.minConfidence) continue;
    grounded.push({ ...entry, effectiveConfidence });
  }
  grounded.sort((a, b) => b.effectiveConfidence - a.effectiveConfidence);

  let applied = 0;
  const appliedKeys: string[] = [];
  const appliedTargets = new Set<string>();
  const newestUserMessageAt = Math.max(...userMessages.map((message) => message.createdAt));
  for (const entry of grounded.slice(0, policy.maxFacts)) {
    // A user-corrected extraction category remains authoritative. Match the
    // stable key across categories so replay cannot recreate the old category,
    // while a genuinely later statement can still refresh the corrected note.
    const categoryCorrections = MemoryStore.getAllEntries().filter(
      (fact) => fact.key === entry.key && fact.categoryCorrectedAt !== undefined,
    );
    const categoryCorrection = categoryCorrections.length === 1 ? categoryCorrections[0] : undefined;
    // A live user-corrected note is stronger authority than an unrelated
    // remaining tombstone that happens to share a broad key anchor.
    const categoryDeletion = categoryCorrection ? undefined : deletionAuthorityFor(entry);
    const effectiveEntry = categoryCorrection || categoryDeletion
      ? { ...entry, category: (categoryCorrection ?? categoryDeletion)!.category }
      : entry;
    const key = categoryDeletion?.key ?? canonicalKeyFor(effectiveEntry);
    const target = `${effectiveEntry.category}\n${key}`;
    if (appliedTargets.has(target)) continue;
    const saved = MemoryStore.getAllEntries().find(
      (fact) => fact.category === effectiveEntry.category && fact.key === key,
    );
    // Multiple corrected tombstones may share a broad anchor, so none can be
    // selected as the canonical note. Their correction metadata still makes
    // an older former-category replay stale without suppressing a genuinely
    // new ambiguous concept that only overlaps ordinary deletions.
    const matchingDeletionTimes = matchingDeletionsFor(entry)
      .filter((deletion) =>
        deletion.categoryCorrectedAt !== undefined &&
        deletion.categoryAliases?.includes(entry.category),
      )
      .map((deletion) => deletion.deletedAt);
    const deletedAt = categoryDeletion?.deletedAt
      ?? (matchingDeletionTimes.length ? Math.max(...matchingDeletionTimes) : undefined)
      ?? MemoryStore.deletedAt(effectiveEntry.category, key);
    // Re-running extraction on an older conversation must not outrank a later
    // user edit. A statement sent after the edit remains eligible, so Core can
    // still learn a genuine subsequent change without freezing the note.
    if (
      saved?.sourceConversationId === 'manual' &&
      newestUserMessageAt <= saved.updatedAt
    ) continue;
    if (
      categoryCorrection?.categoryCorrectedAt !== undefined &&
      newestUserMessageAt <= categoryCorrection.categoryCorrectedAt
    ) continue;
    if (deletedAt !== undefined && newestUserMessageAt <= deletedAt) continue;
    // Candidates are confidence-sorted. Apply only the strongest grounded
    // interpretation of one canonical note so a weaker stale alternate key
    // from the same response cannot immediately overwrite it.
    appliedTargets.add(target);
    MemoryStore.addOrUpdateEntry({
      category: effectiveEntry.category,
      key,
      value: entry.value,
      confidence: entry.effectiveConfidence,
      ...(categoryDeletion?.categoryAliases?.length ? {
        categoryAliases: categoryDeletion.categoryAliases,
        categoryCorrectedAt: categoryDeletion.categoryCorrectedAt ?? categoryDeletion.deletedAt,
      } : {}),
      sourceConversationId: conversationId,
      evidence: entry.quote,
      reason: CATEGORY_REASON[effectiveEntry.category],
    });
    appliedKeys.push(key);
    applied += 1;
  }

  const links = parseLinks(response).slice(0, policy.maxLinks);
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

export function extractFromConversation(
  messages: Message[],
  conversationId: string,
  opts: { force?: boolean; consentToken?: string } = {},
): Promise<number> {
  if (!opts.force) return runExtraction(messages, conversationId, opts);

  const active = manualExtractions.get(conversationId);
  if (active) return active;

  const extraction = runExtraction(messages, conversationId, opts).finally(() => {
    if (manualExtractions.get(conversationId) === extraction) {
      manualExtractions.delete(conversationId);
    }
  });
  manualExtractions.set(conversationId, extraction);
  return extraction;
}
