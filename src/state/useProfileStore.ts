import { create } from 'zustand';
import { UserProfile } from '@/types';
import {
  loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete,
  loadThemePref, saveThemePref, ThemePref,
} from '@/storage/profile';

interface ProfileState {
  profile: UserProfile | null;
  onboarded: boolean;
  hydrated: boolean;
  themePref: ThemePref;
  hydrate: () => Promise<void>;
  completeOnboarding: (p: UserProfile) => Promise<void>;
  setThemePref: (pref: ThemePref) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  onboarded: false,
  hydrated: false,
  themePref: 'dark',
  hydrate: async () => {
    const [profile, onboarded, themePref] = await Promise.all([
      loadProfile(), isOnboardingComplete(), loadThemePref(),
    ]);
    set({ profile, onboarded, themePref, hydrated: true });
  },
  completeOnboarding: async (p) => {
    await saveProfile(p);
    await setOnboardingComplete();
    set({ profile: p, onboarded: true });
  },
  setThemePref: async (pref) => {
    await saveThemePref(pref);
    set({ themePref: pref });
  },
}));
