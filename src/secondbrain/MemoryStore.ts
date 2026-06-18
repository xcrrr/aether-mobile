import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryCategory, MemoryEntry, UserMemory } from './types';
import { uuid } from './id';

/** AsyncStorage key — fixed by the Second Brain spec (not the `@aether/*` namespace). */
const STORAGE_KEY = 'aether_second_brain';

function emptyMemory(): UserMemory {
  return { userId: uuid(), entries: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 };
}

interface SecondBrainState {
  memory: UserMemory;
  /** When false, no extraction runs and memory is not injected. Defaults true. */
  enabled: boolean;
  /** True once the persisted state has rehydrated from AsyncStorage. */
  hydrated: boolean;

  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced'>) => void;
  getEntriesByCategory: (category: MemoryCategory) => MemoryEntry[];
  getAllEntries: () => MemoryEntry[];
  deleteEntry: (id: string) => void;
  clearAll: () => void;

  setEnabled: (enabled: boolean) => void;
  /** Bump extraction stats after a conversation is analysed. */
  recordExtraction: () => void;
}

export const useMemoryStore = create<SecondBrainState>()(
  persist(
    (set, get) => ({
      memory: emptyMemory(),
      enabled: true,
      hydrated: false,

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
            confidence: entry.confidence,
            sourceConversationId: entry.sourceConversationId,
            updatedAt: now,
            timesReinforced: prev.timesReinforced + 1,
          };
        } else {
          entries.push({
            ...entry,
            id: uuid(),
            createdAt: now,
            updatedAt: now,
            timesReinforced: 0,
          });
        }
        set({ memory: { ...get().memory, entries } });
      },

      getEntriesByCategory: (category) =>
        get().memory.entries.filter((e) => e.category === category),

      getAllEntries: () => get().memory.entries,

      deleteEntry: (id) =>
        set({ memory: { ...get().memory, entries: get().memory.entries.filter((e) => e.id !== id) } }),

      clearAll: () =>
        set({ memory: { ...get().memory, entries: [] } }),

      setEnabled: (enabled) => set({ enabled }),

      recordExtraction: () =>
        set({
          memory: {
            ...get().memory,
            lastExtractionAt: Date.now(),
            totalConversationsAnalyzed: get().memory.totalConversationsAnalyzed + 1,
          },
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ memory: s.memory, enabled: s.enabled }),
      onRehydrateStorage: () => (state) => {
        // Ensure a userId exists even on a fresh install / corrupt payload.
        if (state) {
          if (!state.memory?.userId) state.memory = emptyMemory();
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
  addOrUpdateEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'timesReinforced'>) =>
    useMemoryStore.getState().addOrUpdateEntry(entry),
  getEntriesByCategory: (category: MemoryCategory) =>
    useMemoryStore.getState().getEntriesByCategory(category),
  getAllEntries: () => useMemoryStore.getState().getAllEntries(),
  deleteEntry: (id: string) => useMemoryStore.getState().deleteEntry(id),
  clearAll: () => useMemoryStore.getState().clearAll(),
  isEnabled: () => useMemoryStore.getState().enabled,
  setEnabled: (enabled: boolean) => useMemoryStore.getState().setEnabled(enabled),
  recordExtraction: () => useMemoryStore.getState().recordExtraction(),
};
