import { create } from 'zustand';
import { UserProfile } from '@/types';
import { loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete } from '@/storage/profile';

interface ProfileState {
  profile: UserProfile | null;
  onboarded: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: (p: UserProfile) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  onboarded: false,
  hydrated: false,
  hydrate: async () => {
    const [profile, onboarded] = await Promise.all([loadProfile(), isOnboardingComplete()]);
    set({ profile, onboarded, hydrated: true });
  },
  completeOnboarding: async (p) => {
    await saveProfile(p);
    await setOnboardingComplete();
    set({ profile: p, onboarded: true });
  },
}));
