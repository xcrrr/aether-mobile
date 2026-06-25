// Aether design tokens - ported from the "Aether Mobile" design system.
// Two palettes (dark default + warm-paper light) sharing one shape. The active
// palette is resolved per-render via `useColors()` - never import `colors`
// directly for anything that must respond to the theme toggle.

// Dark: Claude-style warm near-black surfaces with a single violet accent.
export const darkColors = {
  // base palette
  black: '#000000',
  white: '#ffffff',
  // Claude palette - warm dark gray, NOT pure black.
  bg: '#1C1C1C',
  bgSidebar: '#161616',
  bgCard: '#252525',
  bgInput: '#252525',
  assistantBubble: '#252525',
  border: '#2E2E2E',
  // Barely-visible hairline divider for flat, card-less sections.
  separator: '#2E2E2E',
  text: '#FFFFFF',
  textMuted: '#8E8E8E',
  textCode: '#E2E2E2',
  codeBlock: '#000000',
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

export type Palette = typeof darkColors;

// Light: warm "paper" off-white. Same violet brand, deepened for AA contrast on
// white. Aurora blobs become soft lavender tints. No yellow/pink cast.
export const lightColors: Palette = {
  black: '#000000',
  white: '#ffffff',
  bg: '#F6F5F2',
  bgSidebar: '#EEEDE9',
  bgCard: '#FFFFFF',
  bgInput: '#FFFFFF',
  assistantBubble: '#FFFFFF',
  border: '#E3E1DC',
  separator: '#E8E6E1',
  text: '#1B1B1A',
  textMuted: '#6B6A65',
  textCode: '#2A2A2A',
  codeBlock: '#EFEDE8',
  violet: '#6D28D9',
  violetStrong: '#5B21B6',
  violetDim: 'rgba(109,40,217,0.10)',
  blue: '#1A73E8',
  danger: '#DC2626',
  dangerBg: '#FCEBEB',
  success: '#16A34A',
  warning: '#B7791F',
  warningBg: 'rgba(183,121,31,0.12)',
  aurora1: '#C4B5FD',
  aurora2: '#DDD6FE',
  aurora3: '#A78BFA',
  purple: '#6D28D9',
  userBubble: '#6D28D9',
  scrim: 'rgba(247,246,242,0.94)',
};

// Default static export = dark. Kept so theme-independent / not-yet-migrated
// callers still compile and render the original dark look.
export const colors: Palette = darkColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

// Type scale (px) - mirrors tokens/typography.css in the Aether design system.
export const fontSize = {
  xs: 11, sm: 12, sm2: 13, base: 14, body: 15, md: 16, lg: 18, title: 28, hero: 32,
};
export const lineHeight = { tight: 1.15, snug: 1.3, body: 1.45 };

// Motion - mirrors tokens/motion.css.
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
