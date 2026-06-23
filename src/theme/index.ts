// Aether design tokens — ported from the "Aether Mobile" design system.
// Dark, near-black surfaces with a single violet accent.

export const colors = {
  // base palette
  black: '#000000',
  white: '#ffffff',
  bg: '#0B0B0F',
  bgCard: '#16161D',
  assistantBubble: '#1C1C24',
  border: '#26262F',
  text: '#F5F5F7',
  textMuted: '#9A9AA8',
  textCode: '#E2E2E2',
  violet: '#7C3AED',
  violetStrong: '#6D28D9',
  violetDim: 'rgba(124,58,237,0.14)',
  blue: '#4285F4',
  danger: '#EF4444',
  dangerBg: '#2A1414',
  success: '#22C55E',
  warning: '#EAB308',
  warningBg: 'rgba(234,179,8,0.12)',
  // Aurora backdrop blobs (V2.0 home/hero)
  aurora1: '#7C3AED',
  aurora2: '#5B21B6',
  aurora3: '#9333EA',
  // semantic aliases (kept for existing callers)
  purple: '#7C3AED',
  userBubble: '#7C3AED',
  scrim: 'rgba(11,11,15,0.96)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

// Type scale (px) — mirrors tokens/typography.css in the Aether design system.
export const fontSize = {
  xs: 11, sm: 12, sm2: 13, base: 14, body: 15, md: 16, lg: 18, title: 28, hero: 32,
};
export const lineHeight = { tight: 1.15, snug: 1.3, body: 1.45 };

// Motion — mirrors tokens/motion.css.
export const motion = {
  durFast: 120, durBase: 220, durSlow: 1900,
  pressOpacity: 0.6, disabledOpacity: 0.45,
};

// Font-family names registered via expo-font in app/_layout.tsx.
export const fonts = {
  sans: 'Inter',
  sansMedium: 'Inter-Medium',
  sansSemibold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
  sansHeavy: 'Inter-Heavy',
  display: 'PlayfairDisplay',
  displayBold: 'PlayfairDisplay-Bold',
  displayHeavy: 'PlayfairDisplay-Heavy',
  mono: 'monospace',
};

// Map a numeric weight to the matching Inter family (RN can't synthesize weights
// from a custom font, so each weight is its own family).
export const interWeight = (w: 400 | 500 | 600 | 700 | 800): string =>
  w === 800 ? fonts.sansHeavy
    : w === 700 ? fonts.sansBold
    : w === 600 ? fonts.sansSemibold
    : w === 500 ? fonts.sansMedium
    : fonts.sans;
