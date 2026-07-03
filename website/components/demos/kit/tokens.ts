// The full app dark palette + type scale, mirrored from app/src/theme/index.ts.
// The demos must read like recordings of the real app, so every value here
// traces back to a token in the mobile theme — never invent a new color.

export const c = {
  bg: '#1C1C1C',
  bgCard: '#252525',
  bgInput: '#252525',
  border: '#2E2E2E',
  separator: '#2E2E2E',
  text: '#FFFFFF',
  textMuted: '#8E8E8E',
  codeBlock: '#000000',
  violet: '#7C3AED',
  violetDim: 'rgba(124,58,237,0.14)',
  danger: '#EF4444',
  success: '#22C55E',
  white: '#ffffff',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const serif = 'var(--font-serif-stack)';
export const sans = 'var(--font-sans-stack)';

// Type styles ported from app typography tokens (px values identical).
export const type = {
  assistantBody: { fontFamily: serif, fontSize: 16, lineHeight: '25px' },
  name: { fontFamily: sans, fontSize: 12, fontWeight: 500, lineHeight: '16px', letterSpacing: '0.4px' },
  input: { fontFamily: sans, fontSize: 15, lineHeight: '21px' },
  label: { fontFamily: sans, fontSize: 13, fontWeight: 500, lineHeight: '18px' },
  chip: { fontFamily: sans, fontSize: 12, fontWeight: 500, lineHeight: '16px' },
  metadata: { fontFamily: sans, fontSize: 11, lineHeight: '15px' },
  caption: { fontFamily: sans, fontSize: 12, lineHeight: '17px' },
  status: { fontFamily: sans, fontSize: 13, lineHeight: '18px' },
  receipt: { fontFamily: sans, fontSize: 11, lineHeight: '16px' },
  wordmark: { fontFamily: serif, fontSize: 20, fontWeight: 500, lineHeight: '23px' },
} as const;
