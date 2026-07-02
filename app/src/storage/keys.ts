export const KEYS = {
  onboardingComplete: '@aether/onboarding_complete',
  profile: '@aether/profile',
  themePref: '@aether/theme_pref',
  settings: '@aether/settings',
  legalAcceptance: '@aether/legal_acceptance',
  conversationsIndex: '@aether/conversations_index',
  conversation: (id: string) => `@aether/conversation/${id}`,
} as const;
