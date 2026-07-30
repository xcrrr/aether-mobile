import { Message } from '@/types';
import { MemoryCategory, MemoryEntry } from './types';
import { normalizeForGrounding } from './grounding';

/**
 * Core recall — decides WHICH saved memories (if any) accompany a chat message.
 *
 * Deterministic by design: relevance is distinctive-token overlap between the
 * current message and a memory's key+value. Stopwords and generic words score
 * nothing, so a low-information message ("hi", "thanks") retrieves nothing by
 * construction — restraint is the default, not a special case.
 */

const STOPWORDS = new Set((
  'a an the i you he she it we they me my your his her its our their this that ' +
  'these those is are was were be been being am do does did have has had can ' +
  'could should would will wont dont cant didnt isnt arent im ive id youre ' +
  'not no yes and or but if then than so to of in on at by for with about from ' +
  'as into over under again once here there when where why how what which who ' +
  'whom all any both each few more most other some such only own same too very ' +
  'just now please tell give show let us lets get got go going come came was'
).split(' '));

/** Generic words that must never count as evidence of relevance on their own. */
const GENERIC = new Set((
  'app ai project work school plan good important model design code research ' +
  'thing things stuff help need want like love day time life new old big small ' +
  'really actually maybe idea job task question answer talk chat say said know ' +
  'think make use using next best way people year today tomorrow'
).split(' '));

/** Explicit user signals that a NEW chat should pick up prior context. */
const CONTINUATION = /\b(continue|continuing|pick up|left off|last time|as we discussed|back to (what|where|our|the))\b/i;

/**
 * Broad self-context questions ("Who am I?", "What do you know about me?") are
 * made entirely of stopwords, so token overlap retrieves nothing by construction.
 * They get their own deterministic route: a bounded, high-confidence profile
 * selection instead of similarity matching.
 */
const PROFILE_BROAD = /\b(who am i|do you know who i am|do (you|you all) (know|remember) me|what can (you|core) tell me about (me|myself)|what do(?:es)? (you|core) (know|remember) about me|what (have you|did you|has core|does core) (learned?|saved?|remembered?) about me|do (you|core) (know|remember) (anything |something )?about me|tell me about (me|myself)|describe me|what do(?:es)? (you|core) know about my (life|self))\b/i;

/**
 * A facet noun alone ("help with my job", "a language learning plan") is a
 * request about that topic, not a request to disclose saved memory. The
 * question must have a self-recall shape as well. Deliberately avoid a bare
 * "tell me" / "do you know" gate: those made ordinary requests such as "tell
 * me how to improve at my job" look like profile questions.
 */
const PROFILE_ASK =
  /\b(?:what\s+(?:are|is|was|were)\s+my\b|what\s+(?:\w+\s+){0,3}am i\b|what\s+(?:do|did)\s+i\s+(?:do|have|know|speak)\b|what\s+do(?:es)?\s+(?:you|core)\s+(?:know|remember)\s+about\s+my\b|(?:what|which)\s+(?:\w+\s+){0,3}do\s+i\b|where\s+(?:(?:do|did)\s+i\s+live|am\s+i\s+(?:living|located|based|from)|is\s+my\s+(?:home|location))\b|who\s+(?:is|are|was|were)\s+my\b|do(?:es)?\s+(?:you|core)\s+(?:know|remember)\s+(?:(?:about\s+|anything\s+about\s+|something\s+about\s+)?my|where|what|which|who)\b|tell\s+me\s+(?:about\s+)?my\b|remind\s+me\s+(?:(?:about|of)\s+my|what|which|where|who)\b|list\s+my\b|describe\s+my\b)/i;

interface ProfileFacet {
  re: RegExp;
  categories: MemoryCategory[];
  /**
   * Some facets share a broad storage category. Keep a job question from
   * returning every saved identity fact (city, language, name, and so on).
   */
  entryRe?: RegExp;
}

const PROFILE_FACETS: ProfileFacet[] = [
  { re: /\b(?:my|and) (preferences?|interests?|hobbies|hobby|passions?)\b/i, categories: ['preferences'] },
  { re: /\b(?:my|and) (goals?|ambitions?)\b/i, categories: ['goals'] },
  { re: /\b(working on|(?:my|and) projects?)\b/i, categories: ['context', 'goals'] },
  {
    re: /\b(?:(?:my|and) (?:job(?!\s+(?:application|search|interview|offer|description|duties|tasks?|projects?|problems?|issues?))|occupation|profession|career|employer|workplace|work role)|what (?:(?:do|did) )?i do for work|where (?:do|did) i work)\b/i,
    categories: ['identity'],
    entryRe: /\b(job|occupation|profession|career|employer|employment|workplace|work role|roles?|works? (?:as|at|for)|employed)\b/i,
  },
  {
    re: /\b(?:(?:my|and) (?:location|home|hometown|home city|city|country|address)|where (?:(?:(?:do|did) )?i live|am i (?:living|located|based|from)|is my (?:home|location)))\b/i,
    categories: ['identity'],
    entryRe: /\b(location|home|hometown|city|country|address|lives?|living|located|based|resides?|residence)\b/i,
  },
  {
    re: /\b(?:(?:my|and) (?:languages?|native language|mother tongue)|(?:what|which) languages? (?:do )?i (?:speak|know|use))\b/i,
    categories: ['identity'],
    entryRe: /\b(language|native|mother tongue|speaks?|spoken|fluen(?:t|cy)|bilingual|multilingual)\b/i,
  },
  {
    re: /\b(?:(?:my|and) (?:relationships?|partner|spouse|wife|husband|boyfriend|girlfriend|family|friends?|children|kids?|parents?|siblings?|brother|sister)|what relationships? do i have|who (?:is|are|was|were) my (?:partner|spouse|wife|husband|boyfriend|girlfriend|friends?|children|kids?|parents?|siblings?|brother|sister))\b/i,
    categories: ['relationships'],
  },
  {
    re: /\b(?:(?:my|and) (?:skills?|strengths?|expertise|abilities)|what (?:skills? do i have|am i good at|do i know))\b/i,
    categories: ['knowledge'],
  },
  {
    re: /\b(?:(?:my|and) (?:personality|traits?|character)|what kind of person am i|describe my personality)\b/i,
    categories: ['personality'],
  },
];

/** Category order for a broad profile summary. Emotional and patterns notes are
 *  sensitive/mechanical and never volunteered in a "who am I" answer. */
const PROFILE_CATEGORY_ORDER: MemoryCategory[] = [
  'identity', 'preferences', 'goals', 'context', 'knowledge', 'relationships', 'personality',
];

interface ProfileRoute {
  categories: MemoryCategory[];
  /** Omitted for a broad profile summary; all allowed categories may contribute. */
  facets?: ProfileFacet[];
}

function profileRoute(text: string): ProfileRoute | null {
  if (PROFILE_ASK.test(text)) {
    const facets: ProfileFacet[] = [];
    const matched = new Set<MemoryCategory>();
    for (const facet of PROFILE_FACETS) {
      if (!facet.re.test(text)) continue;
      facets.push(facet);
      facet.categories.forEach((category) => matched.add(category));
    }
    if (matched.size) return { categories: [...matched], facets };
  }
  if (PROFILE_BROAD.test(text)) return { categories: PROFILE_CATEGORY_ORDER };
  return null;
}

export function profileCategories(text: string): MemoryCategory[] | null {
  return profileRoute(text)?.categories ?? null;
}

function profileEntryMatches(entry: MemoryEntry, route: ProfileRoute): boolean {
  if (!route.facets) return true;
  const text = `${entry.key.replace(/_/g, ' ')} ${entry.value}`;
  return route.facets.some((facet) =>
    facet.categories.includes(entry.category) && (!facet.entryRe || facet.entryRe.test(text)));
}

/** `running` -> `run`, `stopped` -> `stop`. Only for a doubled final consonant. */
function undouble(s: string): string {
  return /([bdfgklmnprt])\1$/.test(s) ? s.slice(0, -1) : s;
}

/**
 * Light morphological normalisation, applied to both sides of every comparison.
 *
 * Matching was exact-token, so "I want to climb this weekend" did not recall a
 * note saying "loves climbing", and "my projects" missed "project". Those are
 * real matches the user would expect Core to make, and they were being lost to
 * a plural or a verb ending.
 *
 * The rules are deliberately shallow. Because both the message and the note are
 * stemmed the same way, an imperfect stem still matches itself; the only real
 * risk is two different words collapsing to one stem, so nothing here touches a
 * short word, and `-ing`/`-ed` need a long one.
 */
export function stemToken(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && /(ses|xes|zes|ches|shes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  if (t.length > 5 && t.endsWith('ing')) return undouble(t.slice(0, -3));
  if (t.length > 4 && t.endsWith('ed')) return undouble(t.slice(0, -2));
  return t;
}

function surfaceTokens(text: string): string[] {
  return normalizeForGrounding(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !GENERIC.has(t) && !/^\d+$/.test(t));
}

export function distinctiveTokens(text: string): string[] {
  return surfaceTokens(text).map(stemToken);
}

/**
 * Stem to the word as it was actually written, so the recall disclosure can name
 * the note's own wording ("matched: climbing") rather than its stem.
 */
function surfaceMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of surfaceTokens(text)) {
    const stem = stemToken(t);
    if (!map.has(stem)) map.set(stem, t);
  }
  return map;
}

export interface RecallPolicy {
  maxTopical: number;
  maxChars: number;
  minScore: number;
}

/**
 * Per-model recall budgets. The relevance bar (one full distinctive-token match)
 * is deliberately identical for both models — a real match means the same thing
 * everywhere. E2B is protected through volume: fewer notes, a smaller character
 * budget, never a context dump.
 */
export function recallPolicy(activeModelId: string | null | undefined): RecallPolicy {
  if (activeModelId === 'gemma4-e4b') return { maxTopical: 6, maxChars: 900, minScore: 1 };
  return { maxTopical: 3, maxChars: 450, minScore: 1 };
}

/**
 * A profile summary is an explicit request to enumerate saved knowledge, so it
 * has a separate, larger envelope than ambient topical recall. Both models can
 * return twenty concise facts; the smaller model retains a tighter character
 * ceiling for long notes.
 */
function profileRecallPolicy(activeModelId: string | null | undefined): RecallPolicy {
  if (activeModelId === 'gemma4-e4b') {
    return { maxTopical: 24, maxChars: 4800, minScore: 1 };
  }
  return { maxTopical: 20, maxChars: 3000, minScore: 1 };
}

export interface RecallItem {
  entry: MemoryEntry;
  /** Human-readable selection reason, e.g. "matched: marathon, october". */
  why: string;
}

export interface RecallResult {
  /** Ambient communication-style notes (topic-free, cap 2). */
  style: MemoryEntry[];
  /** Relevance-gated notes for the current message. */
  topical: RecallItem[];
  /** True when the user asked what Aether knows about them (Core enabled).
   *  Set even with zero matching notes, so the injector can instruct an honest
   *  "no saved context yet" answer instead of "I only know this chat". */
  profileQuery?: boolean;
}

export const EMPTY_RECALL: RecallResult = { style: [], topical: [] };

export interface RecallDisclosureItem {
  key: string;
  why: string;
}

/** Every saved note that reached the model must also reach the reply disclosure. */
export function recallDisclosureItems(recall: RecallResult): RecallDisclosureItem[] {
  const items: RecallDisclosureItem[] = recall.topical.map((item) => ({
    key: item.entry.key,
    why: item.why,
  }));
  const seen = new Set(items.map((item) => item.key));
  for (const entry of recall.style) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    items.push({ key: entry.key, why: 'saved communication preference' });
  }
  return items;
}

export interface RecallInput {
  entries: MemoryEntry[];
  enabled: boolean;
  activeModelId: string | null | undefined;
}

const MEMORY_CATEGORIES = new Set<MemoryCategory>([
  'identity', 'personality', 'preferences', 'goals', 'knowledge',
  'relationships', 'patterns', 'emotional', 'context',
]);

function isRecallableEntry(value: unknown): value is MemoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<MemoryEntry>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.key === 'string' &&
    entry.key.trim().length > 0 &&
    typeof entry.value === 'string' &&
    entry.value.trim().length > 0 &&
    typeof entry.category === 'string' &&
    MEMORY_CATEGORIES.has(entry.category as MemoryCategory)
  );
}

function rankNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function entryTokens(e: MemoryEntry): Set<string> {
  const valueTokens = distinctiveTokens(e.value);
  const keyTokens = distinctiveTokens(e.key.replace(/_/g, ' '));
  const historyValues = Array.isArray(e.history)
    ? e.history
      .filter((revision) => revision && typeof revision.value === 'string')
      .map((revision) => revision.value)
    : [];
  if (e.sourceConversationId !== 'manual' || !historyValues.length) {
    return new Set([...keyTokens, ...valueTokens]);
  }

  // A corrected terse value still needs its stable subject key for later
  // recall. When part of the old key also names the superseded value
  // (`october_marathon`), keep the key's current-value anchor (`marathon`) and
  // drop only its old-only fragment (`october`).
  const current = new Set(valueTokens);
  const history = new Set(historyValues.flatMap(distinctiveTokens));
  const keyHasCurrentAnchor = keyTokens.some((token) => current.has(token));
  const stableKeyTokens = keyHasCurrentAnchor
    ? keyTokens.filter((token) => current.has(token) || !history.has(token))
    : keyTokens;
  return new Set([...stableKeyTokens, ...valueTokens]);
}

/** Sensitive or unconfirmed context needs strong evidence of relevance. */
function thresholdFor(e: MemoryEntry, policy: RecallPolicy): number {
  return e.category === 'emotional' || e.stale ? policy.minScore * 2 : policy.minScore;
}

const COMMUNICATION_STYLE =
  /\b(answers?|repl(?:y|ies)|responses?|messages?|writing|communication|tone|wording|format|concise|brief|detailed|direct|formal|casual|humou?r|jokes?|puns?|emojis?)\b/i;

function styleTier(entries: MemoryEntry[]): MemoryEntry[] {
  return entries
    .filter((e) =>
      (e.category === 'personality' || e.category === 'patterns') &&
      e.timesReinforced >= 1 &&
      !e.stale &&
      COMMUNICATION_STYLE.test(`${e.key.replace(/_/g, ' ')} ${e.value}`),
    )
    .sort((a, b) =>
      rankNumber(b.timesReinforced) - rankNumber(a.timesReinforced) ||
      rankNumber(b.confidence) - rankNumber(a.confidence))
    .slice(0, 2);
}

/**
 * Values are capped to the same length the injector can expose. This keeps the
 * budget meaningful even if a legacy/malformed store contains a huge string.
 */
function recallCost(entry: MemoryEntry): number {
  return Math.min(entry.key.length, 120) + Math.min(entry.value.length, 200);
}

/**
 * Select the memories that accompany the message about to be sent.
 * `messages` must already include the new user message as its last user turn.
 * Fails safe: any internal error returns an empty recall — chat never degrades
 * or blocks because of memory.
 */
export function selectRecall(messages: Message[], input: RecallInput): RecallResult {
  try {
    if (!input.enabled) return EMPTY_RECALL;

    const userTurns = messages.filter((m) => m.role === 'user');
    const currentText = userTurns[userTurns.length - 1]?.content ?? '';
    const previousText = userTurns[userTurns.length - 2]?.content ?? '';
    const isNewConversation = userTurns.length <= 1;

    const profile = profileRoute(currentText);
    const profileCats = profile?.categories ?? null;
    const entries = Array.isArray(input.entries)
      ? input.entries.filter(isRecallableEntry)
      : [];
    if (!entries.length) {
      return profile ? { style: [], topical: [], profileQuery: true } : EMPTY_RECALL;
    }

    const topicalPolicy = recallPolicy(input.activeModelId);
    const selectionPolicy = profile
      ? profileRecallPolicy(input.activeModelId)
      : topicalPolicy;
    const current = new Set(distinctiveTokens(currentText));
    const previous = new Set(distinctiveTokens(previousText));

    const style = styleTier(entries);

    const scored: Array<RecallItem & { score: number }> = [];
    if (current.size || previous.size) {
      for (const entry of entries) {
        try {
          const tokens = entryTokens(entry);
          const surface = surfaceMap(`${entry.key.replace(/_/g, ' ')} ${entry.value}`);
          const evidenceText = typeof entry.evidence === 'string' ? entry.evidence : '';
          const evidence = new Set(distinctiveTokens(evidenceText));
          const evidenceSurface = surfaceMap(evidenceText);
          let score = 0;
          let currentHits = 0;
          const matched: string[] = [];
          const name = (t: string) => surface.get(t) ?? t;
          for (const t of tokens) {
            if (current.has(t)) { score += 1; currentHits += 1; matched.push(name(t)); }
            else if (previous.has(t)) { score += 0.5; matched.push(name(t)); }
          }
          const evidenceMatches = [...evidence].filter((token) => current.has(token));
          // Evidence may improve ordering after key/value relevance qualifies,
          // but it cannot lower that relevance threshold.
          if (currentHits >= 1 && score >= thresholdFor(entry, topicalPolicy)) {
            const evidenceBoost = Math.min(evidenceMatches.length, 3) * 0.15;
            scored.push({ entry, score: score + evidenceBoost, why: `matched: ${matched.join(', ')}` });
          } else if (
            currentHits === 0 &&
            evidenceMatches.length >= 2 &&
            !entry.stale &&
            entry.category !== 'emotional'
          ) {
            // A conservative fallback for terse facts: require two distinctive
            // words from the original supporting quote in the current turn.
            const names = evidenceMatches.slice(0, 3)
              .map((token) => evidenceSurface.get(token) ?? token);
            scored.push({
              entry,
              score: topicalPolicy.minScore + Math.min(evidenceMatches.length - 2, 2) * 0.1,
              why: `matched supporting context: ${names.join(', ')}`,
            });
          }
        } catch {
          // One damaged legacy record must not suppress recall from valid ones.
          continue;
        }
      }
    }
    scored.sort((a, b) =>
      b.score - a.score ||
      rankNumber(b.entry.confidence) - rankNumber(a.entry.confidence) ||
      rankNumber(b.entry.lastSeenAt) - rankNumber(a.entry.lastSeenAt),
    );

    // Profile route: a self-context question selects the strongest notes from
    // the asked-about categories directly — similarity can't see "who am I".
    // Profile picks lead; token-scored matches may fill the remaining budget
    // only when they belong to the requested profile scope.
    if (profile && profileCats) {
      for (let i = scored.length - 1; i >= 0; i--) {
        const entry = scored[i].entry;
        if (!profileCats.includes(entry.category) || !profileEntryMatches(entry, profile)) {
          scored.splice(i, 1);
        }
      }
      const byCat = new Map<MemoryCategory, MemoryEntry[]>(profileCats.map((c) => [c, []]));
      for (const e of entries) {
        if (!e.stale && profileEntryMatches(e, profile)) byCat.get(e.category)?.push(e);
      }
      for (const list of byCat.values()) {
        list.sort((a, b) =>
          rankNumber(b.timesReinforced) - rankNumber(a.timesReinforced) ||
          rankNumber(b.confidence) - rankNumber(a.confidence) ||
          rankNumber(b.lastSeenAt) - rankNumber(a.lastSeenAt),
        );
      }
      // Round-robin across categories so a broad summary covers the whole
      // person, not six notes from whichever category happens to be largest.
      const picks: MemoryEntry[] = [];
      for (let round = 0, added = true; added; round++) {
        added = false;
        for (const c of profileCats) {
          const e = byCat.get(c)![round];
          if (e) { picks.push(e); added = true; }
        }
        if (picks.length >= selectionPolicy.maxTopical) break;
      }
      scored.unshift(...picks.map((entry) => ({
        entry, score: Infinity, why: 'you asked what I know about you',
      })));
    }

    // Continuity is user-initiated: only an explicit "continue" signal in a NEW
    // chat admits recent context. Ongoing chats already carry their own history.
    if (isNewConversation && CONTINUATION.test(currentText)) {
      const picked = new Set(scored.map((s) => s.entry.id));
      const recent = entries
        .filter((e) => (e.category === 'context' || e.category === 'goals') && !e.stale && !picked.has(e.id))
        .sort((a, b) => rankNumber(b.lastSeenAt) - rankNumber(a.lastSeenAt))
        .slice(0, 2);
      for (const entry of recent) {
        scored.push({
          entry,
          score: topicalPolicy.minScore,
          why: 'you asked to continue where you left off',
        });
      }
    }

    const topical: RecallItem[] = [];
    let chars = 0;
    const seen = new Set<string>();
    for (const s of scored) {
      if (topical.length >= selectionPolicy.maxTopical) break;
      if (seen.has(s.entry.id)) continue;
      const cost = recallCost(s.entry);
      if (chars + cost > selectionPolicy.maxChars) continue;
      seen.add(s.entry.id);
      chars += cost;
      topical.push({ entry: s.entry, why: s.why });
    }

    return { style, topical, ...(profile ? { profileQuery: true } : {}) };
  } catch {
    return EMPTY_RECALL;
  }
}
