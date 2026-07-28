import { create } from 'zustand';
import { ResearchProgress } from '@/webresearch/types';

/**
 * Live progress of the research run currently in flight.
 *
 * Transient by design — never persisted. Research progress used to be written
 * into the assistant message body as italic markdown ("_Reading sources 2/3_"),
 * which meant the status was styled as if Aether were talking and the user could
 * not see which pages were being read. This holds the real structure so the chat
 * surface can render it as a card, exactly as `useAgentStore.liveTask` does for
 * Task.
 */
interface ResearchState {
  conversationId: string | null;
  progress: ResearchProgress | null;
  start: (conversationId: string) => void;
  set: (progress: ResearchProgress) => void;
  clear: () => void;
}

export const useResearchStore = create<ResearchState>()((set) => ({
  conversationId: null,
  progress: null,
  start: (conversationId) => set({ conversationId, progress: null }),
  set: (progress) => set({ progress }),
  clear: () => set({ conversationId: null, progress: null }),
}));
