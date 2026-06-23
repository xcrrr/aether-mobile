import { create } from 'zustand';

/**
 * Transient "just saved to your Second Brain" notice. Set by the background
 * extraction queue when a finished chat yields new facts; read by the chat
 * screen to surface a tappable pill that deep-links into the 3D graph.
 */
interface BrainNoticeState {
  count: number;
  /** Bumped on every show so the pill re-animates even for back-to-back saves. */
  nonce: number;
  show: (count: number) => void;
  dismiss: () => void;
}

export const useBrainNotice = create<BrainNoticeState>((set, get) => ({
  count: 0,
  nonce: 0,
  show: (count) => { if (count > 0) set({ count, nonce: get().nonce + 1 }); },
  dismiss: () => set({ count: 0 }),
}));
