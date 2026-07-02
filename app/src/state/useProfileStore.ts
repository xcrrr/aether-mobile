import { create } from 'zustand';
import { UserProfile } from '@/types';
import {
  loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete,
  loadThemePref, saveThemePref, ThemePref,
} from '@/storage/profile';
import {
  acceptLegalDocument,
  hasAcceptedRequiredLegal,
  loadLegalAcceptanceMap,
  type LegalAcceptanceMap,
} from '@/legal/acceptance';

interface ProfileState {
  profile: UserProfile | null;
  onboarded: boolean;
  hydrated: boolean;
  legalAcceptance: LegalAcceptanceMap;
  releaseGateAccepted: boolean;
  themePref: ThemePref;
  hydrate: () => Promise<void>;
  completeOnboarding: (p: UserProfile) => Promise<void>;
  refreshLegalAcceptance: () => Promise<void>;
  acceptCurrentBetaTerms: () => Promise<void>;
  setThemePref: (pref: ThemePref) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  onboarded: false,
  hydrated: false,
  legalAcceptance: {},
  releaseGateAccepted: false,
  themePref: 'dark',
  hydrate: async () => {
    const [profile, onboarded, themePref, legalAcceptance] = await Promise.all([
      loadProfile(), isOnboardingComplete(), loadThemePref(), loadLegalAcceptanceMap(),
    ]);
    set({
      profile,
      onboarded,
      themePref,
      legalAcceptance,
      releaseGateAccepted: hasAcceptedRequiredLegal(legalAcceptance),
      hydrated: true,
    });
  },
  completeOnboarding: async (p) => {
    await saveProfile(p);
    await setOnboardingComplete();
    set({ profile: p, onboarded: true });
  },
  refreshLegalAcceptance: async () => {
    const legalAcceptance = await loadLegalAcceptanceMap();
    set({ legalAcceptance, releaseGateAccepted: hasAcceptedRequiredLegal(legalAcceptance) });
  },
  acceptCurrentBetaTerms: async () => {
    await acceptLegalDocument('beta-terms');
    const legalAcceptance = await loadLegalAcceptanceMap();
    set({ legalAcceptance, releaseGateAccepted: hasAcceptedRequiredLegal(legalAcceptance) });
  },
  setThemePref: async (pref) => {
    await saveThemePref(pref);
    set({ themePref: pref });
  },
}));
