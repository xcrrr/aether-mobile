import { create } from 'zustand';

interface ToastState {
  visible: boolean;
  message: string;
  /** Show a toast with `message`; it auto-dismisses (handled by the Toast view). */
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  visible: false,
  message: '',
  show: (message) => set({ visible: true, message }),
  hide: () => set({ visible: false }),
}));
