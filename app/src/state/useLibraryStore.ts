import { create } from 'zustand';
import { AgentArtifact } from '@/agent/types';
import {
  loadArtifacts,
  saveArtifact,
  deleteArtifact,
  updateArtifact,
} from '@/agent/taskStorage';
import { deriveTitle, inferType } from '@/library/artifact';

/**
 * Reactive view over the single on-device Library store (AsyncStorage, owned by
 * taskStorage's ARTIFACTS_KEY). This holds no separate copy of truth — every
 * mutation writes through to taskStorage and then mirrors the persisted list so
 * the sidebar count and Library screens update live. Nothing here is remote.
 */

interface LibraryState {
  items: AgentArtifact[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Persist a completed Task artifact. Idempotent by id; returns the saved record. */
  keep: (artifact: AgentArtifact, sourceConversationId?: string) => Promise<AgentArtifact>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => AgentArtifact | undefined;
}

export const useLibraryStore = create<LibraryState>((set, getState) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    const items = await loadArtifacts();
    set({ items, hydrated: true });
  },

  keep: async (artifact, sourceConversationId) => {
    const now = Date.now();
    const enriched: AgentArtifact = {
      ...artifact,
      title: deriveTitle(artifact.title, artifact.content),
      type: artifact.type ?? inferType(artifact.title, artifact.content),
      saved: true,
      updatedAt: now,
      sourceConversationId: artifact.sourceConversationId ?? sourceConversationId,
    };
    await saveArtifact(enriched);
    set({ items: await loadArtifacts() });
    return enriched;
  },

  rename: async (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    await updateArtifact(id, { title: clean, updatedAt: Date.now() });
    set({ items: await loadArtifacts() });
  },

  remove: async (id) => {
    await deleteArtifact(id);
    set({ items: await loadArtifacts() });
  },

  get: (id) => getState().items.find((a) => a.id === id),
}));
