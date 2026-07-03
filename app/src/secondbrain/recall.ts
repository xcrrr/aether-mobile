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

/** A facet noun alone ("my project plan…") is a work request, not a memory
 *  question — the message must also ASK what is known/remembered. Allow up to
 *  3 filler words between "what" and the verb so real phrasing like "what
 *  PROJECTS am I working on" still counts as asking (not just the bare "what
 *  am I working on"). */
const PROFILE_ASK = /\b(what\s+(?:\w+\s+){0,3}(?:are|is|were|am i)\b|what do you (know|remember)|do you (know|remember)|tell me|remind me|list)\b/i;

const PROFILE_FACETS: Array<{ re: RegExp; categories: MemoryCategory[] }> = [
  { re: /\bmy (interests?|hobbies|hobby|passions?)\b/i, categories: ['preferences'] },
  { re: /\bmy (goals?|ambitions?)\b/i, categories: ['goals'] },
  { re: /\b(working on|my projects?)\b/i, categories: ['context', 'goals'] },
];

/** Category order for a broad profile summary. Emotional and patterns notes are
 *  sensitive/mechanical and never volunteered in a "who am I" answer. */
const PROFILE_CATEGORY_ORDER: MemoryCategory[] = [
  'identity', 'preferences', 'goals', 'context', 'knowledge', 'relationships', 'personality',
];

export function profileCategories(text: string): MemoryCategory[] | null {
  if (PROFILE_ASK.test(text)) {
    for (const f of PROFILE_FACETS) if (f.re.test(text)) return f.categories;
  }
  if (PROFILE_BROAD.test(text)) return PROFILE_CATEGORY_ORDER;
  return null;
}

export function distinctiveTokens(text: string): string[] {
  return normalizeForGrounding(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !GENERIC.has(t) && !/^\d+$/.test(t));
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

export interface RecallInput {
  entries: MemoryEntry[];
  enabled: boolean;
  activeModelId: string | null | undefined;
}

function entryTokens(e: MemoryEntry): Set<string> {
  return new Set(distinctiveTokens(`${e.key.replace(/_/g, ' ')} ${e.value}`));
}

/** Sensitive or unconfirmed context needs strong evidence of relevance. */
function thresholdFor(e: MemoryEntry, policy: RecallPolicy): number {
  return e.category === 'emotional' || e.stale ? policy.minScore * 2 : policy.minScore;
}

function styleTier(entries: MemoryEntry[]): MemoryEntry[] {
  return entries
    .filter((e) => (e.category === 'personality' || e.category === 'patterns') && e.timesReinforced >= 1 && !e.stale)
    .sort((a, b) => b.timesReinforced - a.timesReinforced || b.confidence - a.confidence)
    .slice(0, 2);
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

    const profileCats = profileCategories(currentText);
    if (!input.entries.length) {
      return profileCats ? { style: [], topical: [], profileQuery: true } : EMPTY_RECALL;
    }

    const policy = recallPolicy(input.activeModelId);
    const current = new Set(distinctiveTokens(currentText));
    const previous = new Set(distinctiveTokens(previousText));

    const style = styleTier(input.entries);

    const scored: Array<RecallItem & { score: number }> = [];
    if (current.size || previous.size) {
      for (const entry of input.entries) {
        const tokens = entryTokens(entry);
        let score = 0;
        let currentHits = 0;
        const matched: string[] = [];
        for (const t of tokens) {
          if (current.has(t)) { score += 1; currentHits += 1; matched.push(t); }
          else if (previous.has(t)) { score += 0.5; matched.push(t); }
        }
        // The current message must win: previous-turn echoes boost ranking but
        // can never qualify a memory on their own.
        if (currentHits >= 1 && score >= thresholdFor(entry, policy)) {
          scored.push({ entry, score, why: `matched: ${matched.join(', ')}` });
        }
      }
    }
    scored.sort((a, b) =>
      b.score - a.score ||
      b.entry.confidence - a.entry.confidence ||
      b.entry.lastSeenAt - a.entry.lastSeenAt,
    );

    // Profile route: a self-context question selects the strongest notes from
    // the asked-about categories directly — similarity can't see "who am I".
    // Profile picks lead; any token-scored matches fill the remaining budget.
    if (profileCats) {
      const byCat = new Map<MemoryCategory, MemoryEntry[]>(profileCats.map((c) => [c, []]));
      for (const e of input.entries) {
        if (!e.stale) byCat.get(e.category)?.push(e);
      }
      for (const list of byCat.values()) {
        list.sort((a, b) =>
          b.timesReinforced - a.timesReinforced ||
          b.confidence - a.confidence ||
          b.lastSeenAt - a.lastSeenAt,
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
        if (picks.length >= policy.maxTopical) break;
      }
      scored.unshift(...picks.map((entry) => ({
        entry, score: Infinity, why: 'you asked what I know about you',
      })));
    }

    // Continuity is user-initiated: only an explicit "continue" signal in a NEW
    // chat admits recent context. Ongoing chats already carry their own history.
    if (isNewConversation && CONTINUATION.test(currentText)) {
      const picked = new Set(scored.map((s) => s.entry.id));
      const recent = input.entries
        .filter((e) => (e.category === 'context' || e.category === 'goals') && !e.stale && !picked.has(e.id))
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .slice(0, 2);
      for (const entry of recent) {
        scored.push({ entry, score: policy.minScore, why: 'you asked to continue where you left off' });
      }
    }

    const topical: RecallItem[] = [];
    let chars = 0;
    const seen = new Set<string>();
    for (const s of scored) {
      if (topical.length >= policy.maxTopical) break;
      if (seen.has(s.entry.id)) continue;
      const cost = s.entry.key.length + s.entry.value.length;
      if (chars + cost > policy.maxChars && topical.length > 0) continue;
      seen.add(s.entry.id);
      chars += cost;
      topical.push({ entry: s.entry, why: s.why });
    }

    return { style, topical, ...(profileCats ? { profileQuery: true } : {}) };
  } catch {
    return EMPTY_RECALL;
  }
}
