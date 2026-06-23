import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryCategory, MemoryEntry, MemoryEdge, UserMemory } from './types';
import { uuid } from './id';

/** AsyncStorage key — fixed by the Second Brain spec (not the `@aether/*` namespace). */
const STORAGE_KEY = 'aether_second_brain';

const STALE_WINDOW_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const STALE_CONFIDENCE = 0.4;

function emptyMemory(): UserMemory {
  return { userId: uuid(), entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 };
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

  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced' | 'lastSeenAt'>) => void;
  updateEntry: (id: string, patch: { value?: string; category?: MemoryCategory }) => void;
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
        const entries = [...get().memory.entries];
        const idx = entries.findIndex(
          (e) => e.category === entry.category && e.key === entry.key,
        );
        if (idx >= 0) {
          const prev = entries[idx];
          entries[idx] = {
            ...prev,
            value: entry.value,
            confidence: Math.min(1, Math.max(prev.confidence, entry.confidence) + 0.05),
            sourceConversationId: entry.sourceConversationId,
            updatedAt: now,
            lastSeenAt: now,
            stale: false,
            timesReinforced: prev.timesReinforced + 1,
          };
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
        set({ memory: { ...get().memory, entries } });
      },

      updateEntry: (id, patch) => {
        const now = Date.now();
        const entries = get().memory.entries.map((e) => {
          if (e.id !== id) return e;
          return {
            ...e,
            ...(patch.value !== undefined ? { value: patch.value } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
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
        const entries = get().memory.entries.filter((e) => e.id !== id);
        const keys = new Set(entries.map((e) => e.key));
        const edges = (get().memory.edges ?? []).filter((e) => keys.has(e.fromKey) && keys.has(e.toKey));
        set({ memory: { ...get().memory, entries, edges } });
      },

      clearAll: () =>
        set({ memory: { ...get().memory, entries: [], edges: [] } }),

      addManualEntry: (input) => {
        get().addOrUpdateEntry({
          category: input.category,
          key: input.key,
          value: input.value,
          confidence: 1,
          sourceConversationId: 'manual',
        });
      },

      purgeStale: () => {
        const entries = get().memory.entries.filter((e) => !e.stale);
        const keys = new Set(entries.map((e) => e.key));
        const edges = (get().memory.edges ?? []).filter((e) => keys.has(e.fromKey) && keys.has(e.toKey));
        set({ memory: { ...get().memory, entries, edges } });
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
          e.confidence < STALE_CONFIDENCE && now - e.lastSeenAt > STALE_WINDOW_MS ? { ...e, stale: true } : e,
        );
        set({ memory: { ...get().memory, entries } });
      },

      setEnabled: (enabled) => set({ enabled }),

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
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ memory: s.memory, enabled: s.enabled }),
      onRehydrateStorage: () => (state) => {
        // Ensure a userId exists even on a fresh install / corrupt payload.
        // Backfill new fields on legacy payloads.
        if (state) {
          if (!state.memory?.userId) state.memory = emptyMemory();
          if (!Array.isArray(state.memory.edges)) state.memory.edges = [];
          state.memory.entries = (state.memory.entries ?? []).map((e) => ({
            ...e,
            lastSeenAt: e.lastSeenAt ?? e.updatedAt ?? e.createdAt ?? Date.now(),
          }));
          // Recompute stale on every rehydration so decay is applied at startup.
          const now = Date.now();
          state.memory.entries = state.memory.entries.map((e) => ({
            ...e,
            stale: e.confidence < STALE_CONFIDENCE && now - e.lastSeenAt > STALE_WINDOW_MS ? true : e.stale,
          }));
          state.hydrated = true;
        }
      },
    },
  ),
);

/**
 * Non-hook accessors for use outside React (LlamaService / prompt building /
 * extractor). They read/write the same store instance.
 */
export const MemoryStore = {
  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced' | 'lastSeenAt'>) =>
    useMemoryStore.getState().addOrUpdateEntry(entry),
  updateEntry: (id: string, patch: { value?: string; category?: MemoryCategory }) =>
    useMemoryStore.getState().updateEntry(id, patch),
  getEntriesByCategory: (category: MemoryCategory) =>
    useMemoryStore.getState().getEntriesByCategory(category),
  getAllEntries: () => useMemoryStore.getState().getAllEntries(),
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
  setEnabled: (enabled: boolean) => useMemoryStore.getState().setEnabled(enabled),
  recordExtraction: () => useMemoryStore.getState().recordExtraction(),
  setRecentKeys: (keys: string[]) => useMemoryStore.getState().setRecentKeys(keys),
  clearRecentKeys: () => useMemoryStore.getState().clearRecentKeys(),
};
