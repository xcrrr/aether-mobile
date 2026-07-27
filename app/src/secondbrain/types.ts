/**
 * Second Brain — a private, on-device memory layer. Conversations are silently
 * analysed and distilled into structured facts about the user, which are then
 * injected into every system prompt for full personal context.
 */

export type MemoryCategory =
  | 'identity'        // name, age, location, occupation, languages spoken
  | 'personality'     // communication style, humor, directness, curiosity level
  | 'preferences'     // topics they love, things they dislike, hobbies
  | 'goals'           // short-term and long-term goals they mention
  | 'knowledge'       // domains they know well, skill levels
  | 'relationships'   // people they mention, their role
  | 'patterns'        // time of day they chat, message length preference, emoji use
  | 'emotional'       // stress triggers, things that make them happy, tone shifts
  | 'context';        // current projects, recent life events, recurring problems

export type MemoryVisualCategory =
  | 'projects'
  | 'work'
  | 'people'
  | 'learning'
  | 'health'
  | 'travel'
  | 'personal'
  | 'uncategorized';

export const MEMORY_VISUAL_CATEGORIES: readonly MemoryVisualCategory[] = [
  'projects',
  'work',
  'people',
  'learning',
  'health',
  'travel',
  'personal',
  'uncategorized',
] as const;

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  'identity',
  'personality',
  'preferences',
  'goals',
  'knowledge',
  'relationships',
  'patterns',
  'emotional',
  'context',
] as const;

/** A superseded value of a fact, kept so updates never silently erase history. */
export interface MemoryRevision {
  value: string;
  replacedAt: number;            // Unix ms
}

export interface MemoryEntry {
  id: string;                    // uuid
  category: MemoryCategory;
  key: string;                   // e.g. "preferred_language", "main_goal"
  value: string;                 // the extracted fact
  confidence: number;            // 0.0–1.0
  visualCategory?: MemoryVisualCategory; // user-corrected graph/category placement
  categoryCorrectedAt?: number;  // user authority over extraction category (Unix ms)
  categoryAliases?: MemoryCategory[]; // prior extraction categories preserved after correction
  sourceConversationId: string;
  createdAt: number;             // Unix ms
  updatedAt: number;
  timesReinforced: number;       // incremented when the same fact reappears
  lastSeenAt: number;            // Unix ms — bumped each time the fact is re-observed
  stale?: boolean;               // single-observation + long-unseen; de-emphasized in the graph
  evidence?: string;             // verbatim user quote the fact was grounded against
  reason?: string;               // one human-readable sentence: why this was saved
  history?: MemoryRevision[];    // previous values, newest first (capped)
}

/** A directed relationship between two facts (by key), e.g. business —located_in→ city. */
export interface MemoryEdge {
  id: string;
  fromKey: string;
  toKey: string;
  relation: string;
}

export interface MemoryDeletion {
  category: MemoryCategory;
  categoryAliases?: MemoryCategory[];
  categoryCorrectedAt?: number;
  key: string;
  deletedAt: number;
}

export interface UserMemory {
  userId: string;                // device-generated UUID, persisted
  entries: MemoryEntry[];
  edges: MemoryEdge[];
  deletions?: MemoryDeletion[];  // local authority against replaying older conversations
  lastExtractionAt: number;      // Unix ms, 0 if never
  totalConversationsAnalyzed: number;
}
