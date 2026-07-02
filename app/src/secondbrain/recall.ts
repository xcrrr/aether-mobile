import { Message } from '@/types';
import { MemoryEntry } from './types';
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
    if (!input.enabled || !input.entries.length) return EMPTY_RECALL;

    const userTurns = messages.filter((m) => m.role === 'user');
    const currentText = userTurns[userTurns.length - 1]?.content ?? '';
    const previousText = userTurns[userTurns.length - 2]?.content ?? '';
    const isNewConversation = userTurns.length <= 1;

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

    return { style, topical };
  } catch {
    return EMPTY_RECALL;
  }
}
