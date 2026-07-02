/**
 * Deterministic goal routing for the Task pill. Decides — in code, before any
 * model call — whether a message needs the agent kernel at all:
 *
 *  - 'chat'   → obvious smalltalk / simple questions answer as ordinary chat
 *               (zero task machinery, zero extra model calls)
 *  - 'refine' → a follow-up that clearly means "change the existing draft"
 *               becomes ONE revise call on that artifact, never a new task
 *  - 'task'   → everything else runs through the kernel
 *
 * The rules are deliberately conservative: misrouting a real task to 'chat'
 * loses capability, so only unambiguous patterns leave the 'task' default.
 * Ambiguous goals still resolve cheaply — the kernel can finish on step one.
 */

export type GoalRoute = 'chat' | 'refine' | 'task';

/** Follow-ups that operate on the current draft ("make it shorter", "add risks"). */
const REFINE_PREFIX = new RegExp(
  '^(please\\s+)?(' +
  [
    'make (it|that|this)\\b',
    'shorten', 'trim', 'condense', 'tighten', 'simplify', 'polish',
    'expand', 'extend', 'lengthen',
    'add\\b', 'remove\\b', 'drop the\\b',
    'rewrite', 'reword', 'rephrase', 'revise\\b', 'tweak\\b',
    'update (it|that|the)\\b', 'change (it|that|the)\\b',
    'translate (it|that|this)\\b',
    'turn (it|that|this) into\\b', 'convert (it|that|this)\\b',
  ].join('|') +
  ')',
  'i',
);

/** A refinement is a short instruction, not a fresh multi-part goal. */
const REFINE_MAX_CHARS = 220;

const SMALLTALK = /^(hi|hiya|hey|heya|hello|yo|sup|thanks|thank you|thx|ok(ay)?|cool|nice|great|good (morning|afternoon|evening|night)|how are you|what'?s up)\b/i;

const TASK_VERBS = /\b(make|create|write|draft|plan|research|build|find|compare|organi[sz]e|summari[sz]e|analy[sz]e|generate|design|prepare|turn|convert|put together|come up with)\b/i;

/** Signals that fresh/current information matters — never route these to plain chat. */
const CURRENCY = /\b(today|tonight|now|current(ly)?|latest|recent(ly)?|this (week|month|year)|news|price|weather|20\d\d)\b/i;

const SIMPLE_QUESTION_MAX_WORDS = 9;

export function routeGoal(goal: string, opts: { hasPriorArtifact: boolean }): GoalRoute {
  const g = goal.trim();
  if (!g) return 'chat';
  const words = g.split(/\s+/).length;

  if (opts.hasPriorArtifact && g.length <= REFINE_MAX_CHARS && REFINE_PREFIX.test(g)) {
    return 'refine';
  }

  if (SMALLTALK.test(g) && g.length <= 60) return 'chat';

  if (
    g.endsWith('?') &&
    words <= SIMPLE_QUESTION_MAX_WORDS &&
    !TASK_VERBS.test(g) &&
    !CURRENCY.test(g)
  ) {
    return 'chat';
  }

  return 'task';
}
