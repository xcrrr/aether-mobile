import type { TextStyle } from 'react-native';

// Aether design tokens - ported from the "Aether Mobile" design system.
// Two palettes (dark default + warm-paper light) sharing one shape. The active
// palette is resolved per-render via `useColors()` - never import `colors`
// directly for anything that must respond to the theme toggle.

export const darkColors = {
  black: '#000000',
  white: '#ffffff',
  bg: '#1C1C1C',
  bgSidebar: '#161616',
  bgCard: '#252525',
  bgInput: '#252525',
  assistantBubble: '#252525',
  border: '#2E2E2E',
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
  aurora1: '#7C3AED',
  aurora2: '#5B21B6',
  aurora3: '#9333EA',
  purple: '#7C3AED',
  userBubble: '#7C3AED',
  scrim: 'rgba(11,11,15,0.96)',
};

export type Palette = typeof darkColors;

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

export const colors: Palette = darkColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export const fontSize = {
  micro: 10, xs: 11, sm: 12, sm2: 13, base: 14, body: 15, md: 16, lg: 18,
  xl: 20, xxl: 24, display: 30, hero: 36, brand: 46,
};
export const lineHeight = { tight: 1.15, snug: 1.3, body: 1.45 };

export const motion = {
  durFast: 120, durBase: 220, durSlow: 1900,
  pressOpacity: 0.6, disabledOpacity: 0.45,
  pressScale: 0.96, pressFade: 0.92,
};

export const shadow = {
  sm: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  lg: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

export const fonts = {
  sans: 'InstrumentSans',
  sansMedium: 'InstrumentSans-Medium',
  sansSemibold: 'InstrumentSans-SemiBold',
  sansBold: 'InstrumentSans-SemiBold',
  sansHeavy: 'InstrumentSans-SemiBold',
  serif: 'Newsreader',
  serifItalic: 'Newsreader-Italic',
  display: 'Newsreader-Medium',
  displayBold: 'Newsreader-Medium',
  displayHeavy: 'Newsreader-Medium',
  mono: 'monospace',
};

export const interWeight = (w: 400 | 500 | 600 | 700 | 800): string =>
  w === 800 ? fonts.sansHeavy
    : w === 700 ? fonts.sansBold
      : w === 600 ? fonts.sansSemibold
        : w === 500 ? fonts.sansMedium
          : fonts.sans;

export const typography = {
  assistantBody: {
    fontFamily: fonts.serif,
    fontSize: fontSize.md,
    lineHeight: 25,
  },
  assistantBodyCompact: {
    fontFamily: fonts.serif,
    fontSize: fontSize.body,
    lineHeight: 22,
  },
  assistantHeading: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    lineHeight: 24,
  },
  editorialTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxl,
    lineHeight: 31,
  },
  editorialSubtitle: {
    fontFamily: fonts.serif,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
  screenTitle: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.xl,
    lineHeight: 25,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.body,
    lineHeight: 20,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: fontSize.base,
    lineHeight: 21,
  },
  bodySmall: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm2,
    lineHeight: 19,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.sm2,
    lineHeight: 18,
  },
  button: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
  chip: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.sm,
    lineHeight: 16,
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: fontSize.body,
    lineHeight: 21,
  },
  metadata: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    lineHeight: 15,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    lineHeight: 17,
  },
  receipt: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  status: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm2,
    lineHeight: 18,
  },
} satisfies Record<string, TextStyle>;
