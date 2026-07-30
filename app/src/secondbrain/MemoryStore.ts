import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryCategory, MemoryEntry, MemoryEdge, MemoryRevision, MemoryVisualCategory, UserMemory } from './types';
import { uuid } from './id';

/** AsyncStorage key — fixed by the Second Brain spec (not the `@aether/*` namespace). */
const STORAGE_KEY = 'aether_second_brain';

const STALE_WINDOW_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const MAX_HISTORY = 5;
let extractionConsentToken = uuid();

/** Stale = a single unconfirmed observation not re-seen for the whole window. */
function isStale(e: MemoryEntry, now: number): boolean {
  return e.timesReinforced === 0 && now - e.lastSeenAt > STALE_WINDOW_MS;
}

function emptyMemory(): UserMemory {
  return { userId: uuid(), entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 };
}

/** Normalise a fact value for duplicate detection (case/whitespace/trailing punctuation). */
function normValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '');
}

/** Keep manually entered labels aligned with the extractor's stable key format. */
function normKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Collapse legacy violations of the real store identity: category + normalized
 * key. Equal values under different keys can describe different facts
 * (`birth_city` and `current_city` may both be Warsaw), so value alone is never
 * deletion authority.
 */
export function dedupeEntries(entries: MemoryEntry[]): MemoryEntry[] {
  const byFact = new Map<string, MemoryEntry>();
  for (const e of entries) {
    const sig = `${e.category}\n${normKey(e.key)}`;
    const prev = byFact.get(sig);
    if (!prev) {
      byFact.set(sig, { ...e });
      continue;
    }
    const sameValue = normValue(e.value) === normValue(prev.value);
    const stronger = sameValue
      ? (
          e.timesReinforced > prev.timesReinforced ||
          (e.timesReinforced === prev.timesReinforced && e.confidence > prev.confidence)
            ? e : prev
        )
      : (
          e.updatedAt > prev.updatedAt ||
          (e.updatedAt === prev.updatedAt && e.sourceConversationId === 'manual')
            ? e : prev
        );
    const weaker = stronger === e ? prev : e;
    const superseded = sameValue
      ? []
      : [{ value: weaker.value, replacedAt: stronger.updatedAt }];
    const history = [...superseded, ...(stronger.history ?? []), ...(weaker.history ?? [])]
      .sort((a, b) => b.replacedAt - a.replacedAt)
      .slice(0, MAX_HISTORY);
    byFact.set(sig, {
      ...stronger,
      confidence: Math.max(prev.confidence, e.confidence),
      timesReinforced: sameValue
        ? prev.timesReinforced + e.timesReinforced + 1
        : stronger.timesReinforced,
      createdAt: Math.min(prev.createdAt, e.createdAt),
      updatedAt: Math.max(prev.updatedAt, e.updatedAt),
      lastSeenAt: Math.max(prev.lastSeenAt, e.lastSeenAt),
      stale: stronger.stale && weaker.stale,
      evidence: stronger.evidence ?? weaker.evidence,
      reason: stronger.reason ?? weaker.reason,
      ...(history.length ? { history } : {}),
    });
  }
  return [...byFact.values()];
}

interface SecondBrainState {
  memory: UserMemory;
  /** When false, no extraction runs and memory is not injected. Defaults true. */
  enabled: boolean;
  /** True once the persisted state has rehydrated from AsyncStorage. */
  hydrated: boolean;
  /** Keys learned/updated in the most recent extraction — used to light up new
   *  nodes in the graph. Transient (never persisted); cleared once viewed. */
  recentKeys: string[];

  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced' | 'lastSeenAt'>) => boolean;
  updateEntry: (id: string, patch: { value?: string; category?: MemoryCategory; visualCategory?: MemoryVisualCategory }) => void;
  getEntriesByCategory: (category: MemoryCategory) => MemoryEntry[];
  getAllEntries: () => MemoryEntry[];
  deleteEntry: (id: string) => void;
  clearAll: () => void;
  addManualEntry: (input: { category: MemoryCategory; key: string; value: string }) => void;
  purgeStale: () => void;

  addEdge: (edge: Omit<MemoryEdge, 'id'>) => void;
  deleteEdge: (id: string) => void;
  markStale: () => void;

  setEnabled: (enabled: boolean) => void;
  /** Bump extraction stats after a conversation is analysed. */
  recordExtraction: () => void;
  setRecentKeys: (keys: string[]) => void;
  clearRecentKeys: () => void;
  resetLocalState: () => void;
}

export const useMemoryStore = create<SecondBrainState>()(
  persist(
    (set, get) => ({
      memory: emptyMemory(),
      enabled: true,
      hydrated: false,
      recentKeys: [],

      addOrUpdateEntry: (entry) => {
        const now = Date.now();
        const deletions = (get().memory.deletions ?? []).filter(
          (deletion) =>
            deletion.category !== entry.category || normKey(deletion.key) !== normKey(entry.key),
        );
        const entries = [...get().memory.entries];
        const idx = entries.findIndex(
          (e) => e.category === entry.category && normKey(e.key) === normKey(entry.key),
        );
        if (idx >= 0) {
          const prev = entries[idx];
          if (
            entry.evidenceMessageId !== undefined &&
            entry.evidenceMessageId === prev.evidenceMessageId
          ) {
            return false;
          }
          const changed = normValue(prev.value) !== normValue(entry.value);
          if (changed) {
            // The fact CHANGED: keep the old value in history and start over —
            // a new observation must earn its own confidence, not inherit the
            // old one, and the update must never silently erase what was known.
            const history: MemoryRevision[] = [
              { value: prev.value, replacedAt: now },
              ...(prev.history ?? []),
            ].slice(0, MAX_HISTORY);
            entries[idx] = {
              ...prev,
              value: entry.value,
              confidence: entry.confidence,
              sourceConversationId: entry.sourceConversationId,
              updatedAt: now,
              lastSeenAt: now,
              stale: false,
              timesReinforced: 0,
              evidence: entry.sourceConversationId === 'manual' ? undefined : entry.evidence ?? prev.evidence,
              evidenceMessageId: entry.sourceConversationId === 'manual' ? undefined : entry.evidenceMessageId,
              observedAt: entry.sourceConversationId === 'manual' ? undefined : entry.observedAt,
              reason: entry.reason ?? prev.reason,
              history,
            };
          } else {
            // Same fact re-observed: reinforce. Confidence is the best evidence
            // seen so far — never artificially inflated.
            entries[idx] = {
              ...prev,
              confidence: Math.max(prev.confidence, entry.confidence),
              sourceConversationId: entry.sourceConversationId,
              updatedAt: now,
              lastSeenAt: now,
              stale: false,
              timesReinforced: prev.timesReinforced + 1,
              evidence: entry.sourceConversationId === 'manual' ? undefined : entry.evidence ?? prev.evidence,
              evidenceMessageId: entry.sourceConversationId === 'manual'
                ? undefined
                : entry.evidenceMessageId ?? prev.evidenceMessageId,
              observedAt: entry.sourceConversationId === 'manual'
                ? undefined
                : entry.observedAt ?? prev.observedAt,
              reason: entry.reason ?? prev.reason,
            };
          }
        } else {
          entries.push({
            ...entry,
            id: uuid(),
            createdAt: now,
            updatedAt: now,
            lastSeenAt: now,
            timesReinforced: 0,
          });
        }
        set({ memory: { ...get().memory, entries, deletions } });
        return true;
      },

      updateEntry: (id, patch) => {
        const now = Date.now();
        const entries = get().memory.entries.map((e) => {
          if (e.id !== id) return e;
          const valueChanged = patch.value !== undefined && normValue(patch.value) !== normValue(e.value);
          const categoryChanged = patch.category !== undefined && patch.category !== e.category;
          const history: MemoryRevision[] | undefined = valueChanged
            ? [
                { value: e.value, replacedAt: now },
                ...(e.history ?? []),
              ].slice(0, MAX_HISTORY)
            : e.history;
          return {
            ...e,
            ...(patch.value !== undefined ? { value: patch.value } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.visualCategory !== undefined ? { visualCategory: patch.visualCategory } : {}),
            ...(categoryChanged ? {
              categoryCorrectedAt: now,
              categoryAliases: [...new Set([...(e.categoryAliases ?? []), e.category])],
            } : {}),
            ...(valueChanged ? {
              confidence: 1,
              sourceConversationId: 'manual',
              timesReinforced: 0,
              evidence: undefined,
              reason: 'You corrected this Core note',
              history,
            } : {}),
            ...(categoryChanged && !valueChanged ? {
              sourceConversationId: 'manual',
              reason: 'You corrected this Core note category',
            } : {}),
            updatedAt: now,
            lastSeenAt: now,
            stale: false,
          };
        });
        set({ memory: { ...get().memory, entries } });
      },

      getEntriesByCategory: (category) =>
        get().memory.entries.filter((e) => e.category === category),

      getAllEntries: () => get().memory.entries,

      deleteEntry: (id) => {
        const deleted = get().memory.entries.find((e) => e.id === id);
        const entries = get().memory.entries.filter((e) => e.id !== id);
        const keys = new Set(entries.map((e) => e.key));
        const edges = (get().memory.edges ?? []).filter((e) => keys.has(e.fromKey) && keys.has(e.toKey));
        const deletions = deleted
          ? [
              ...(get().memory.deletions ?? []).filter(
                (item) => item.category !== deleted.category || item.key !== deleted.key,
              ),
              {
                category: deleted.category,
                categoryAliases: deleted.categoryAliases,
                categoryCorrectedAt: deleted.categoryCorrectedAt,
                key: deleted.key,
                deletedAt: Date.now(),
              },
            ]
          : get().memory.deletions;
        set({ memory: { ...get().memory, entries, edges, deletions } });
      },

      clearAll: () => {
        extractionConsentToken = uuid();
        const memory = get().memory;
        const clearedAt = Date.now();
        const clearedKeys = new Set(
          memory.entries.map((entry) => `${entry.category}\n${entry.key}`),
        );
        const deletions = [
          ...(memory.deletions ?? []).filter(
            (deletion) => !clearedKeys.has(`${deletion.category}\n${deletion.key}`),
          ),
          ...memory.entries.map((entry) => ({
            category: entry.category,
            categoryAliases: entry.categoryAliases,
            categoryCorrectedAt: entry.categoryCorrectedAt,
            key: entry.key,
            deletedAt: clearedAt,
          })),
        ];
        set({
          memory: { ...memory, entries: [], edges: [], deletions },
          recentKeys: [],
        });
      },

      addManualEntry: (input) => {
        get().addOrUpdateEntry({
          category: input.category,
          key: normKey(input.key),
          value: input.value,
          confidence: 1,
          sourceConversationId: 'manual',
          reason: 'You added this memory yourself',
        });
      },

      purgeStale: () => {
        const memory = get().memory;
        const purgedAt = Date.now();
        const stale = memory.entries.filter((e) => e.stale);
        const entries = memory.entries.filter((e) => !e.stale);
        const keys = new Set(entries.map((e) => e.key));
        const edges = (memory.edges ?? []).filter((e) => keys.has(e.fromKey) && keys.has(e.toKey));
        const purgedKeys = new Set(stale.map((entry) => `${entry.category}\n${entry.key}`));
        const deletions = [
          ...(memory.deletions ?? []).filter(
            (deletion) => !purgedKeys.has(`${deletion.category}\n${deletion.key}`),
          ),
          ...stale.map((entry) => ({
            category: entry.category,
            categoryAliases: entry.categoryAliases,
            categoryCorrectedAt: entry.categoryCorrectedAt,
            key: entry.key,
            deletedAt: purgedAt,
          })),
        ];
        set({ memory: { ...memory, entries, edges, deletions } });
      },

      addEdge: (edge) => {
        const edges = [...(get().memory.edges ?? [])];
        if (edges.some((e) => e.fromKey === edge.fromKey && e.toKey === edge.toKey && e.relation === edge.relation)) return;
        edges.push({ ...edge, id: uuid() });
        set({ memory: { ...get().memory, edges } });
      },

      deleteEdge: (id) => {
        const edges = (get().memory.edges ?? []).filter((e) => e.id !== id);
        set({ memory: { ...get().memory, edges } });
      },

      markStale: () => {
        const now = Date.now();
        const entries = get().memory.entries.map((e) =>
          isStale(e, now) ? { ...e, stale: true } : e,
        );
        set({ memory: { ...get().memory, entries } });
      },

      setEnabled: (enabled) => {
        if (enabled !== get().enabled) extractionConsentToken = uuid();
        set({ enabled });
      },

      recordExtraction: () =>
        set({
          memory: {
            ...get().memory,
            lastExtractionAt: Date.now(),
            totalConversationsAnalyzed: get().memory.totalConversationsAnalyzed + 1,
          },
        }),

      setRecentKeys: (keys) => set({ recentKeys: keys }),
      clearRecentKeys: () => set({ recentKeys: [] }),
      resetLocalState: () => {
        extractionConsentToken = uuid();
        set({
          memory: emptyMemory(),
          enabled: true,
          hydrated: true,
          recentKeys: [],
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ memory: s.memory, enabled: s.enabled }),
      onRehydrateStorage: () => (state) => {
        extractionConsentToken = uuid();
        // Ensure a userId exists even on a fresh install / corrupt payload.
        // Backfill new fields on legacy payloads.
        if (state) {
          if (!state.memory?.userId) state.memory = emptyMemory();
          if (!Array.isArray(state.memory.edges)) state.memory.edges = [];
          if (!Array.isArray(state.memory.deletions)) state.memory.deletions = [];
          state.memory.entries = (state.memory.entries ?? []).map((e) => ({
            ...e,
            lastSeenAt: e.lastSeenAt ?? e.updatedAt ?? e.createdAt ?? Date.now(),
          }));
          // Clean up duplicates already saved before dedup existed.
          state.memory.entries = dedupeEntries(state.memory.entries);
          const liveKeys = new Set(state.memory.entries.map((e) => e.key));
          state.memory.edges = (state.memory.edges ?? []).filter(
            (e) => liveKeys.has(e.fromKey) && liveKeys.has(e.toKey),
          );
          // Recompute stale on every rehydration so decay is applied at startup.
          const now = Date.now();
          state.memory.entries = state.memory.entries.map((e) => ({
            ...e,
            stale: isStale(e, now) ? true : e.stale,
          }));
          state.hydrated = true;
        }
      },
    },
  ),
);

/**
 * Resolve once the persisted state has loaded from AsyncStorage.
 *
 * The chat send path reads Core SYNCHRONOUSLY the first time it touches this
 * module (`require(...)` → `getAllEntries()`), but zustand `persist` rehydrates
 * ASYNCHRONOUSLY. On a cold start where chat is the first surface to load the
 * store, that read lands before rehydration and returns zero entries — the exact
 * "I have no saved Core notes" failure, even though notes exist on disk. Awaiting
 * this before recall closes the race. Capped so a stuck read can never block a
 * reply; recall already fails safe to empty.
 */
function ensureHydrated(): Promise<void> {
  const p = useMemoryStore.persist;
  if (p.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      unsub();
      clearTimeout(timer);
      resolve();
    };
    const unsub = p.onFinishHydration(finish);
    // Rehydration finished between the check and the subscribe.
    if (p.hasHydrated()) return finish();
    timer = setTimeout(finish, 1500);
  });
}

/**
 * Non-hook accessors for use outside React (prompt building /
 * extractor). They read/write the same store instance.
 */
export const MemoryStore = {
  ensureHydrated,
  hasHydrated: () => useMemoryStore.persist.hasHydrated(),
  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced' | 'lastSeenAt'>) =>
    useMemoryStore.getState().addOrUpdateEntry(entry),
  updateEntry: (id: string, patch: { value?: string; category?: MemoryCategory; visualCategory?: MemoryVisualCategory }) =>
    useMemoryStore.getState().updateEntry(id, patch),
  getEntriesByCategory: (category: MemoryCategory) =>
    useMemoryStore.getState().getEntriesByCategory(category),
  getAllEntries: () => useMemoryStore.getState().getAllEntries(),
  getDeletions: () => useMemoryStore.getState().memory.deletions ?? [],
  deletionFor: (category: MemoryCategory, key: string) => {
    const matches = (useMemoryStore.getState().memory.deletions ?? []).filter(
      (deletion) => deletion.key === key && (
        deletion.category === category || deletion.categoryAliases?.includes(category)
      ),
    );
    return matches.length === 1 ? matches[0] : undefined;
  },
  deletedAt: (category: MemoryCategory, key: string) =>
    useMemoryStore.getState().memory.deletions?.find(
      (deletion) => deletion.category === category && deletion.key === key,
    )?.deletedAt,
  deleteEntry: (id: string) => useMemoryStore.getState().deleteEntry(id),
  clearAll: () => useMemoryStore.getState().clearAll(),
  addManualEntry: (input: { category: MemoryCategory; key: string; value: string }) =>
    useMemoryStore.getState().addManualEntry(input),
  purgeStale: () => useMemoryStore.getState().purgeStale(),
  addEdge: (edge: Omit<MemoryEdge, 'id'>) => useMemoryStore.getState().addEdge(edge),
  deleteEdge: (id: string) => useMemoryStore.getState().deleteEdge(id),
  markStale: () => useMemoryStore.getState().markStale(),
  getAllEdges: () => useMemoryStore.getState().memory.edges,
  isEnabled: () => useMemoryStore.getState().enabled,
  extractionConsentToken: () => extractionConsentToken,
  setEnabled: (enabled: boolean) => useMemoryStore.getState().setEnabled(enabled),
  recordExtraction: () => useMemoryStore.getState().recordExtraction(),
  setRecentKeys: (keys: string[]) => useMemoryStore.getState().setRecentKeys(keys),
  clearRecentKeys: () => useMemoryStore.getState().clearRecentKeys(),
  resetLocalState: () => useMemoryStore.getState().resetLocalState(),
};
