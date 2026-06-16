import { create } from 'zustand';
import { UserProfile } from '@/types';

type Draft = Partial<UserProfile>;
interface DraftState { draft: Draft; set: (patch: Draft) => void; }

export const useOnboardingDraft = create<DraftState>((set) => ({
  draft: {},
  set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
}));
