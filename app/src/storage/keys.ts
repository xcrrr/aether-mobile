export const KEYS = {
  onboardingComplete: '@aether/onboarding_complete',
  profile: '@aether/profile',
  themePref: '@aether/theme_pref',
  replyHaptics: '@aether/reply_haptics',
  settings: '@aether/settings',
  legalAcceptance: '@aether/legal_acceptance',
  conversationsIndex: '@aether/conversations_index',
  conversation: (id: string) => `@aether/conversation/${id}`,
  /** Persisted SAF tree URI where exported artifact PDFs are saved. */
  downloadsTreeUri: '@aether/downloads_tree_uri',
} as const;
