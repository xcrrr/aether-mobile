# Aether Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page, dark, scroll-driven marketing site for Aether (local-first Android AI app) with a faithful HTML/CSS recreation of the app chat UI that types and streams replies on scroll, plus mission, features, dummy newsletter signup, and Discord CTA.

**Architecture:** Next.js App Router single page composed of section components. A reusable token layer (Tailwind theme + CSS vars) ports the app's exact colors/spacing. The showpiece is a sticky `PhoneFrame` whose `ChatReplay` maps scroll progress → a deterministic conversation timeline (Framer Motion `useScroll`/`useTransform`), revealing user bubbles and character-streaming assistant replies. All motion is `transform`/`opacity` only and fully disabled under `prefers-reduced-motion`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Framer Motion, self-hosted Playfair Display + Inter via `next/font/local`. Jest + React Testing Library for unit tests. Deploy: Vercel.

**Working directory:** `/home/xcrr1/aether-website` (new repo, git already initialized, spec at `docs/specs/2026-06-24-aether-website-design.md`).

---

## File Structure

```
aether-website/
  app/
    layout.tsx                      # fonts, metadata, SiteNav, Footer, grain overlay
    page.tsx                        # composes all sections in order
    globals.css                     # Tailwind + token CSS vars + base + reduced-motion
  lib/
    tokens.ts                       # exact app color/spacing/motion constants (single source)
    useReducedMotion.ts             # SSR-safe prefers-reduced-motion hook
  content/
    script.ts                       # scripted conversation beats (data only)
    features.ts                     # feature row copy (data only)
  components/
    aurora/Aurora.tsx               # drifting violet blobs + vignette + grain
    phone/PhoneFrame.tsx            # device shell
    phone/ChatReplay.tsx            # sticky scroll-driven timeline driver
    phone/useTypewriter.ts          # progress -> revealed substring
    phone/chat/UserBubble.tsx
    phone/chat/AssistantTurn.tsx
    phone/chat/TypingDots.tsx
    phone/chat/InputBar.tsx
    sections/Hero.tsx
    sections/Mission.tsx
    sections/Features.tsx
    sections/HowItWorks.tsx
    sections/Cta.tsx
    ui/FeatureRow.tsx
    ui/SignupForm.tsx               # dummy: validates, fake success, stores nothing
    ui/DiscordButton.tsx
    ui/SiteNav.tsx
    ui/Footer.tsx
  __tests__/                        # colocated unit tests mirror component paths
  public/fonts/                     # self-hosted woff2
  public/grain.png                  # film-grain overlay
  jest.config.ts
  jest.setup.ts
```

Constants flow one way: `lib/tokens.ts` → Tailwind theme + components. `content/*` holds pure data consumed by sections. The scroll timeline math lives in `useTypewriter.ts` + `ChatReplay.tsx` and is unit-tested in isolation.

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: project via CLI, then trim
- Modify: `package.json`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`

- [ ] **Step 1: Scaffold**

Run from `/home/xcrr1`:
```bash
npx --yes create-next-app@latest aether-website-tmp \
  --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --turbopack
```
Then move generated files into the existing repo (which already has `docs/` + `.git`):
```bash
cp -r aether-website-tmp/. aether-website/ 2>/dev/null
rm -rf aether-website/.git-tmp; rm -rf aether-website-tmp/.git
rsync -a --exclude=.git aether-website-tmp/ aether-website/
rm -rf aether-website-tmp
```
Expected: `aether-website/app/page.tsx`, `app/layout.tsx`, `package.json`, `tailwind.config` (or v4 CSS config) exist; `docs/` preserved.

- [ ] **Step 2: Verify dev build boots**

Run: `cd /home/xcrr1/aether-website && npm run build`
Expected: build succeeds (default starter compiles).

- [ ] **Step 3: Replace starter page with a placeholder**

Replace `app/page.tsx` with:
```tsx
export default function Home() {
  return <main className="min-h-screen bg-[#1C1C1C] text-white">Aether</main>;
}
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind app"
```

---

## Task 2: Install deps + Jest test harness

**Files:**
- Modify: `package.json`
- Create: `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Install runtime + test deps**

Run:
```bash
cd /home/xcrr1/aether-website
npm install framer-motion
npm install -D jest @types/jest ts-node jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @babel/preset-env @babel/preset-react @babel/preset-typescript
```

- [ ] **Step 2: Create Jest config**

Create `jest.config.ts`:
```ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    }],
  },
};
export default config;
```

Create `jest.setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"` add:
```json
"test": "jest"
```

- [ ] **Step 4: Add a smoke test**

Create `__tests__/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('home renders wordmark', () => {
  render(<Home />);
  expect(screen.getByText('Aether')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add jest + testing-library harness"
```

---

## Task 3: Design tokens

**Files:**
- Create: `lib/tokens.ts`, `__tests__/tokens.test.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing test**

Create `__tests__/tokens.test.ts`:
```ts
import { colors, spacing, radius } from '@/lib/tokens';

test('ports exact app palette', () => {
  expect(colors.bg).toBe('#1C1C1C');
  expect(colors.bgCard).toBe('#252525');
  expect(colors.border).toBe('#2E2E2E');
  expect(colors.violet).toBe('#7C3AED');
  expect(colors.textMuted).toBe('#8E8E8E');
  expect(colors.success).toBe('#22C55E');
});

test('ports spacing + radius scales', () => {
  expect(spacing.xl).toBe(24);
  expect(radius.lg).toBe(16);
  expect(radius.full).toBe(999);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tokens`
Expected: FAIL (`@/lib/tokens` not found).

- [ ] **Step 3: Implement tokens**

Create `lib/tokens.ts`:
```ts
export const colors = {
  bg: '#1C1C1C',
  bgSidebar: '#161616',
  bgCard: '#252525',
  bgInput: '#252525',
  border: '#2E2E2E',
  separator: '#2E2E2E',
  text: '#FFFFFF',
  textMuted: '#8E8E8E',
  violet: '#7C3AED',
  violetStrong: '#6D28D9',
  violetDim: 'rgba(124,58,237,0.14)',
  aurora1: '#7C3AED',
  aurora2: '#5B21B6',
  aurora3: '#9333EA',
  success: '#22C55E',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const motion = { durFast: 0.12, durBase: 0.22, durSlow: 1.9 } as const;
export const ease = [0.22, 1, 0.36, 1] as const; // out-expo-ish
```

- [ ] **Step 4: Expose tokens as CSS vars + base styles**

Replace `app/globals.css` with:
```css
@import "tailwindcss";

@theme {
  --color-bg: #1C1C1C;
  --color-card: #252525;
  --color-border: #2E2E2E;
  --color-text: #FFFFFF;
  --color-muted: #8E8E8E;
  --color-violet: #7C3AED;
  --color-violet-strong: #6D28D9;
  --color-success: #22C55E;
}

html, body { background: #1C1C1C; color: #FFFFFF; }
* { box-sizing: border-box; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tokens`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: design tokens ported from app theme"
```

---

## Task 4: Self-hosted fonts + reduced-motion hook

**Files:**
- Create: `public/fonts/` (woff2 files), `lib/useReducedMotion.ts`, `__tests__/useReducedMotion.test.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Fetch fonts**

Download Inter + Playfair Display woff2 into `public/fonts/`:
```bash
cd /home/xcrr1/aether-website && mkdir -p public/fonts
# Inter (variable) + Playfair Display (variable) woff2 from the google-fonts mirror or fontsource:
npm install @fontsource/inter @fontsource-variable/playfair-display
cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2 public/fonts/Inter-400.woff2
cp node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2 public/fonts/Inter-500.woff2
cp node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2 public/fonts/Inter-600.woff2
cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2 public/fonts/Inter-700.woff2
cp node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2 public/fonts/PlayfairDisplay.woff2
```
Expected: 5 woff2 files in `public/fonts/`.

- [ ] **Step 2: Wire fonts in layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  variable: '--font-inter',
  src: [
    { path: '../public/fonts/Inter-400.woff2', weight: '400' },
    { path: '../public/fonts/Inter-500.woff2', weight: '500' },
    { path: '../public/fonts/Inter-600.woff2', weight: '600' },
    { path: '../public/fonts/Inter-700.woff2', weight: '700' },
  ],
});
const playfair = localFont({
  variable: '--font-playfair',
  src: [{ path: '../public/fonts/PlayfairDisplay.woff2', weight: '400 900' }],
});

export const metadata: Metadata = {
  title: 'Aether — Your AI. On your phone. Nowhere else.',
  description: 'Sovereign, local-first AI assistant for Android. Every reply runs on your device. No datacenters, no surveillance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Write failing test for the hook**

Create `__tests__/useReducedMotion.test.tsx`:
```tsx
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/lib/useReducedMotion';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
}

test('returns true when user prefers reduced motion', () => {
  mockMatchMedia(true);
  const { result } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(true);
});

test('returns false otherwise', () => {
  mockMatchMedia(false);
  const { result } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(false);
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- useReducedMotion`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement hook**

Create `lib/useReducedMotion.ts`:
```ts
'use client';
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- useReducedMotion`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: self-hosted fonts + reduced-motion hook"
```

---

## Task 5: Aurora backdrop

**Files:**
- Create: `components/aurora/Aurora.tsx`, `__tests__/Aurora.test.tsx`, `public/grain.png`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Aurora.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { Aurora } from '@/components/aurora/Aurora';

test('renders three aurora blobs', () => {
  const { container } = render(<Aurora />);
  expect(container.querySelectorAll('[data-blob]')).toHaveLength(3);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Aurora`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement Aurora**

Create `components/aurora/Aurora.tsx`. Three blurred radial blobs drifting via CSS keyframes on `transform` only; a vignette; a grain overlay. `intensity` scales opacity.
```tsx
'use client';
import { colors } from '@/lib/tokens';

const BLOBS = [
  { color: colors.aurora1, size: 620, from: '-8% -12%', to: '10% 6%', dur: '11s', delay: '0s' },
  { color: colors.aurora2, size: 560, from: '28% 14%', to: '-6% -10%', dur: '13s', delay: '0.4s' },
  { color: colors.aurora3, size: 540, from: '6% 48%', to: '-12% 20%', dur: '12s', delay: '0.8s' },
] as const;

export function Aurora({ intensity = 1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          data-blob
          style={{
            position: 'absolute',
            width: b.size, height: b.size,
            left: b.from.split(' ')[0], top: b.from.split(' ')[1],
            background: `radial-gradient(circle at center, ${b.color} 0%, transparent 68%)`,
            opacity: 0.6 * intensity,
            filter: 'blur(40px)',
            animation: `auroraDrift${i} ${b.dur} ${b.delay} ease-in-out infinite alternate`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 40%, transparent 38%, #1C1C1C 100%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: 'url(/grain.png)', backgroundRepeat: 'repeat' }}
      />
      <style>{`
        @keyframes auroraDrift0 { to { transform: translate(18%, 18%) scale(1.3); } }
        @keyframes auroraDrift1 { to { transform: translate(-34%, -24%) scale(0.85); } }
        @keyframes auroraDrift2 { to { transform: translate(-18%, -28%) scale(1.3); } }
        @media (prefers-reduced-motion: reduce) {
          [data-blob] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: Add grain texture**

Generate a tiny tileable noise PNG into `public/grain.png`:
```bash
cd /home/xcrr1/aether-website
node -e "const z=require('zlib'),fs=require('fs');const s=128,buf=Buffer.alloc(s*s*4);for(let i=0;i<s*s;i++){const v=Math.floor(Math.random()*255);buf[i*4]=v;buf[i*4+1]=v;buf[i*4+2]=v;buf[i*4+3]=255;}function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const ty=Buffer.from(t);const c=Buffer.concat([ty,d]);const crc=Buffer.alloc(4);crc.writeUInt32BE(require('zlib').crc32?require('zlib').crc32(c):0);return Buffer.concat([l,c,crc]);}console.log('use sharp instead');"
```
If the inline approach is awkward, instead install and use sharp:
```bash
npm install -D sharp
node -e "const sharp=require('sharp');const s=128;const raw=Buffer.alloc(s*s*3);for(let i=0;i<s*s;i++){const v=Math.floor(Math.random()*255);raw[i*3]=v;raw[i*3+1]=v;raw[i*3+2]=v;}sharp(raw,{raw:{width:s,height:s,channels:3}}).png().toFile('public/grain.png').then(()=>console.log('grain written'));"
```
Expected: `public/grain.png` exists.

- [ ] **Step 5: Run tests**

Run: `npm test -- Aurora`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: aurora backdrop with drifting blobs, vignette, grain"
```

---

## Task 6: Chat primitives — UserBubble, AssistantTurn, TypingDots, InputBar

**Files:**
- Create: `components/phone/chat/UserBubble.tsx`, `AssistantTurn.tsx`, `TypingDots.tsx`, `InputBar.tsx`, `__tests__/chat.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/chat.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { UserBubble } from '@/components/phone/chat/UserBubble';
import { AssistantTurn } from '@/components/phone/chat/AssistantTurn';
import { TypingDots } from '@/components/phone/chat/TypingDots';
import { InputBar } from '@/components/phone/chat/InputBar';

test('user bubble shows text, violet background', () => {
  const { container } = render(<UserBubble text="Hi Aether" />);
  expect(screen.getByText('Hi Aether')).toBeInTheDocument();
  const bubble = container.querySelector('[data-user-bubble]') as HTMLElement;
  expect(bubble.style.backgroundColor).toBe('rgb(124, 58, 237)');
});

test('assistant turn shows Aether label and content', () => {
  render(<AssistantTurn text="Hello there" />);
  expect(screen.getByText('Aether')).toBeInTheDocument();
  expect(screen.getByText('Hello there')).toBeInTheDocument();
});

test('typing dots renders three dots', () => {
  const { container } = render(<TypingDots />);
  expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
});

test('input bar shows placeholder + footer line', () => {
  render(<InputBar />);
  expect(screen.getByText('Message Aether')).toBeInTheDocument();
  expect(screen.getByText(/Replies run on-device/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- chat`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement UserBubble** (ported from app `MessageBubble.tsx` user branch)

Create `components/phone/chat/UserBubble.tsx`:
```tsx
import { colors, radius } from '@/lib/tokens';

export function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
      <div
        data-user-bubble
        style={{
          maxWidth: '82%',
          backgroundColor: colors.violet,
          color: '#fff',
          fontSize: 15,
          lineHeight: '22px',
          padding: '10px 15px',
          borderRadius: radius.lg,
          borderBottomRightRadius: radius.sm,
        }}
      >
        {text}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement AssistantTurn** (bare text, muted "Aether" label above — port from app assistant branch)

Create `components/phone/chat/AssistantTurn.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function AssistantTurn({ text, caret = false }: { text: string; caret?: boolean }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.2 }}>
        Aether
      </div>
      <div style={{ fontSize: 15, lineHeight: '23px', color: colors.text, whiteSpace: 'pre-wrap' }}>
        {text}
        {caret && <span data-caret style={{ opacity: 0.7 }}>▍</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement TypingDots** (port `TypingIndicator`)

Create `components/phone/chat/TypingDots.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function TypingDots() {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.2 }}>
        Aether
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '6px 0' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-dot
            style={{
              width: 6, height: 6, borderRadius: 999, backgroundColor: colors.textMuted,
              animation: `typingBlink 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typingBlink { 0%,80%,100% { opacity: 0.25; } 40% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { [data-dot] { animation: none !important; } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 6: Implement InputBar** (static, non-interactive — port `ChatInput.tsx` chrome)

Create `components/phone/chat/InputBar.tsx`:
```tsx
import { colors, radius } from '@/lib/tokens';

export function InputBar() {
  return (
    <div style={{ backgroundColor: colors.bg, paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 22 }}>+</div>
        <div
          style={{
            flex: 1, maxHeight: 120, backgroundColor: colors.bgInput, borderRadius: radius.xl,
            color: colors.textMuted, padding: '11px 16px', fontSize: 15, lineHeight: '21px',
          }}
        >
          Message Aether
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 18 }}>↑</div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted, padding: '8px 0' }}>
        Aether is an AI and can make mistakes. Replies run on-device.
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run tests**

Run: `npm test -- chat`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: chat primitives ported from app UI"
```

---

## Task 7: Typewriter math (scroll progress → revealed text)

**Files:**
- Create: `components/phone/useTypewriter.ts`, `__tests__/useTypewriter.test.ts`

- [ ] **Step 1: Write the failing test**

The conversation is a list of beats. A pure function maps a global scroll progress `p ∈ [0,1]` and a beat timeline to: which messages are fully shown, and the partial reveal length of the streaming message. Create `__tests__/useTypewriter.test.ts`:
```ts
import { resolveTimeline, Beat } from '@/components/phone/useTypewriter';

const beats: Beat[] = [
  { role: 'user', text: 'Hi' },                 // 2 chars
  { role: 'assistant', text: 'Hello world' },   // 11 chars
];

test('at p=0 nothing is revealed', () => {
  const s = resolveTimeline(beats, 0);
  expect(s.shown).toHaveLength(0);
  expect(s.streamingIndex).toBe(0);
  expect(s.revealed).toBe('');
});

test('at p=1 everything is fully revealed', () => {
  const s = resolveTimeline(beats, 1);
  expect(s.shown.map((m) => m.text)).toEqual(['Hi', 'Hello world']);
  expect(s.streamingIndex).toBe(-1);
});

test('mid-progress streams the assistant message partially', () => {
  // user beat occupies first half, assistant the second half
  const s = resolveTimeline(beats, 0.75);
  expect(s.shown.map((m) => m.text)).toEqual(['Hi']);
  expect(s.streamingIndex).toBe(1);
  expect(s.revealed.length).toBeGreaterThan(0);
  expect(s.revealed.length).toBeLessThan('Hello world'.length);
  expect('Hello world'.startsWith(s.revealed)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- useTypewriter`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement timeline resolver**

Create `components/phone/useTypewriter.ts`. Each beat gets an equal slice of `[0,1]`. User beats appear instantly at slice start; assistant beats stream across their slice. (Equal slices keep the math simple and testable; visual pacing is tuned via track height.)
```ts
export interface Beat {
  role: 'user' | 'assistant';
  text: string;
}

export interface TimelineState {
  shown: Beat[];          // fully-revealed beats before the streaming one
  streamingIndex: number; // index of the beat currently streaming, -1 if none
  revealed: string;       // partial text of the streaming beat
}

export function resolveTimeline(beats: Beat[], p: number): TimelineState {
  const n = beats.length;
  if (n === 0) return { shown: [], streamingIndex: -1, revealed: '' };
  if (p >= 1) return { shown: beats.slice(), streamingIndex: -1, revealed: '' };
  const slice = 1 / n;
  const idx = Math.min(n - 1, Math.floor(p / slice));
  const local = (p - idx * slice) / slice; // 0..1 within current beat
  const shown = beats.slice(0, idx);
  const beat = beats[idx];
  if (beat.role === 'user') {
    // user appears instantly; treat as shown once we enter its slice
    return { shown: beats.slice(0, idx + 1), streamingIndex: -1, revealed: '' };
  }
  const count = Math.max(0, Math.min(beat.text.length, Math.floor(local * beat.text.length)));
  return { shown, streamingIndex: idx, revealed: beat.text.slice(0, count) };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- useTypewriter`
Expected: PASS (3 tests).

Note: the `p=0.75` case — with 2 beats, slice = 0.5; idx=1 (assistant), local=0.5 → ~5 chars revealed. Matches assertions.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scroll-progress timeline resolver"
```

---

## Task 8: Conversation script content

**Files:**
- Create: `content/script.ts`, `__tests__/script.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/script.test.ts`:
```ts
import { conversation } from '@/content/script';
import type { Beat } from '@/components/phone/useTypewriter';

test('script alternates user/assistant and is non-empty', () => {
  expect(conversation.length).toBeGreaterThanOrEqual(4);
  conversation.forEach((b: Beat, i) => {
    expect(b.text.length).toBeGreaterThan(0);
    expect(b.role).toBe(i % 2 === 0 ? 'user' : 'assistant');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- script`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement script**

Create `content/script.ts`:
```ts
import type { Beat } from '@/components/phone/useTypewriter';

export const conversation: Beat[] = [
  { role: 'user', text: 'What can you do without internet?' },
  { role: 'assistant', text: 'Everything. I run entirely on your phone — no servers, no account. Ask me anything, summarize a document, or talk it through out loud.' },
  { role: 'user', text: 'Is anything sent to the cloud?' },
  { role: 'assistant', text: 'No. Nothing you type or say leaves your device. The model lives in your pocket, and so does your data.' },
];
```

- [ ] **Step 4: Run tests**

Run: `npm test -- script`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scripted conversation content"
```

---

## Task 9: PhoneFrame + ChatReplay (sticky scroll driver)

**Files:**
- Create: `components/phone/PhoneFrame.tsx`, `components/phone/ChatReplay.tsx`, `__tests__/ChatReplay.test.tsx`

- [ ] **Step 1: Write the failing test**

`ChatReplay` accepts a `progress` value (0..1) so it's testable without scroll. Create `__tests__/ChatReplay.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { ChatReplayView } from '@/components/phone/ChatReplay';
import { conversation } from '@/content/script';

test('progress=1 renders all beats fully', () => {
  render(<ChatReplayView beats={conversation} progress={1} />);
  expect(screen.getByText(conversation[0].text)).toBeInTheDocument();
  expect(screen.getByText(conversation[3].text)).toBeInTheDocument();
});

test('progress=0 renders no conversation text', () => {
  render(<ChatReplayView beats={conversation} progress={0} />);
  expect(screen.queryByText(conversation[1].text)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ChatReplay`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement PhoneFrame**

Create `components/phone/PhoneFrame.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 360, height: 740, borderRadius: 44, padding: 12,
        background: '#0c0c0c', border: `1px solid ${colors.border}`,
        boxShadow: '0 40px 120px -20px rgba(124,58,237,0.25), 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      <div
        style={{
          width: '100%', height: '100%', borderRadius: 32, overflow: 'hidden',
          background: colors.bg, position: 'relative', display: 'flex', flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement ChatReplay (view + scroll wrapper)**

Create `components/phone/ChatReplay.tsx`. `ChatReplayView` is pure (progress in → rendered conversation). `ChatReplay` wraps it with a tall sticky scroll track using Framer Motion `useScroll`.
```tsx
'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { PhoneFrame } from './PhoneFrame';
import { Aurora } from '@/components/aurora/Aurora';
import { UserBubble } from './chat/UserBubble';
import { AssistantTurn } from './chat/AssistantTurn';
import { TypingDots } from './chat/TypingDots';
import { InputBar } from './chat/InputBar';
import { resolveTimeline, Beat } from './useTypewriter';

export function ChatReplayView({ beats, progress }: { beats: Beat[]; progress: number }) {
  const state = resolveTimeline(beats, progress);
  const thinking = state.streamingIndex >= 0 && state.revealed.length === 0;
  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Aurora intensity={thinking || state.streamingIndex >= 0 ? 0.5 : 0} />
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', padding: '56px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div>
          {state.shown.map((b, i) =>
            b.role === 'user'
              ? <UserBubble key={i} text={b.text} />
              : <AssistantTurn key={i} text={b.text} />,
          )}
          {state.streamingIndex >= 0 && (
            state.revealed.length === 0
              ? <TypingDots />
              : <AssistantTurn text={state.revealed} caret />
          )}
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 12px 12px' }}>
        <InputBar />
      </div>
    </PhoneFrame>
  );
}

export function ChatReplay({ beats }: { beats: Beat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useTransform(scrollYProgress, (v) => v);
  return (
    <div ref={ref} style={{ height: '320vh', position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ReplayBridge beats={beats} progress={progress} />
      </div>
    </div>
  );
}

function ReplayBridge({ beats, progress }: { beats: Beat[]; progress: ReturnType<typeof useTransform<number, number>> }) {
  const [p, setP] = useState(0);
  useMotionValueEvent(progress, 'change', setP);
  return <ChatReplayView beats={beats} progress={p} />;
}
```
Add the missing imports at the top: `import { useState } from 'react';` and `import { useMotionValueEvent } from 'framer-motion';` (merge into existing import lines).

- [ ] **Step 5: Run tests**

Run: `npm test -- ChatReplay`
Expected: PASS (2 tests).

- [ ] **Step 6: Reduced-motion fallback**

In `ChatReplay` (the scroll wrapper), when `useReducedMotion()` is true, skip the tall track and render `<ChatReplayView beats={beats} progress={1} />` centered in a normal-height section. Add:
```tsx
import { useReducedMotion } from '@/lib/useReducedMotion';
// inside ChatReplay, before the return:
const reduced = useReducedMotion();
if (reduced) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ChatReplayView beats={beats} progress={1} />
    </div>
  );
}
```

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: sticky scroll-driven chat replay in phone frame"
```

---

## Task 10: Hero section

**Files:**
- Create: `components/sections/Hero.tsx`, `__tests__/Hero.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Hero.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/sections/Hero';

test('hero shows wordmark, manifesto, and both CTAs', () => {
  render(<Hero />);
  expect(screen.getByRole('heading', { name: 'Aether' })).toBeInTheDocument();
  expect(screen.getByText(/On your phone/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /beta/i })).toHaveAttribute('href', '#beta');
  expect(screen.getByRole('link', { name: /discord/i })).toHaveAttribute('href', 'https://discord.gg/sYEhDHjDXe');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Hero`
Expected: FAIL.

- [ ] **Step 3: Implement Hero**

Create `components/sections/Hero.tsx`:
```tsx
import { Aurora } from '@/components/aurora/Aurora';
import { colors } from '@/lib/tokens';

export function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', overflow: 'hidden' }}>
      <Aurora intensity={1} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 'clamp(64px, 14vw, 160px)', letterSpacing: '-0.03em', margin: 0 }}>
          Aether
        </h1>
        <p style={{ fontSize: 'clamp(18px, 3vw, 26px)', color: colors.textMuted, marginTop: 16, maxWidth: 640 }}>
          Your AI. On your phone. Nowhere else.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          <a href="#beta" style={{ background: colors.violet, color: '#fff', padding: '14px 28px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}>
            Join the beta
          </a>
          <a href="https://discord.gg/sYEhDHjDXe" target="_blank" rel="noreferrer" style={{ border: `1px solid ${colors.border}`, color: '#fff', padding: '14px 28px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}>
            Discord
          </a>
        </div>
      </div>
      <div aria-hidden style={{ position: 'absolute', bottom: 28, color: colors.textMuted, fontSize: 13, letterSpacing: '0.2em' }}>
        SCROLL
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Hero`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hero section"
```

---

## Task 11: Mission section

**Files:**
- Create: `components/sections/Mission.tsx`, `__tests__/Mission.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Mission.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Mission } from '@/components/sections/Mission';

test('mission states both pillars', () => {
  render(<Mission />);
  expect(screen.getByText(/No datacenters/i)).toBeInTheDocument();
  expect(screen.getByText(/No surveillance/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Mission`
Expected: FAIL.

- [ ] **Step 3: Implement Mission**

Create `components/sections/Mission.tsx`:
```tsx
import { colors } from '@/lib/tokens';

const PILLARS = [
  { title: 'No datacenters.', body: 'Every reply runs on your phone. No servers burning electricity to answer your questions — the most private AI is also the lightest on the planet.' },
  { title: 'No surveillance.', body: 'Nothing you type or say leaves your device. No accounts, no logging, no training on your life. Your thoughts stay yours.' },
];

export function Mission() {
  return (
    <section style={{ padding: '160px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 80 }}>
        {PILLARS.map((p) => (
          <div key={p.title} style={{ maxWidth: 720 }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 'clamp(40px, 7vw, 72px)', margin: 0, letterSpacing: '-0.02em' }}>
              {p.title}
            </h2>
            <p style={{ fontSize: 'clamp(17px, 2.2vw, 21px)', color: colors.textMuted, marginTop: 20, lineHeight: 1.6 }}>
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- Mission`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mission section"
```

---

## Task 12: Features content + FeatureRow + Features section

**Files:**
- Create: `content/features.ts`, `components/ui/FeatureRow.tsx`, `components/sections/Features.tsx`, `__tests__/Features.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Features.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Features } from '@/components/sections/Features';
import { features } from '@/content/features';

test('all features render their titles', () => {
  render(<Features />);
  features.forEach((f) => {
    expect(screen.getByRole('heading', { name: f.title })).toBeInTheDocument();
  });
});

test('there are five features', () => {
  expect(features).toHaveLength(5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Features`
Expected: FAIL.

- [ ] **Step 3: Implement features content**

Create `content/features.ts`:
```ts
export interface Feature {
  title: string;
  body: string;
  visual: 'chat' | 'vision' | 'research' | 'memory' | 'voice';
}

export const features: Feature[] = [
  { title: 'On-device AI', body: 'A full language model runs inside your phone. Offline, private, and instant — your assistant works on a plane, in a tunnel, anywhere.', visual: 'chat' },
  { title: 'It can see', body: 'Show Aether a photo and it understands what it is looking at. Vision is built into the model — no upload, no cloud.', visual: 'vision' },
  { title: 'Web research, cited', body: 'Flip on Research and Aether searches the open web, reads the sources, and answers with citations you can check.', visual: 'research' },
  { title: 'A second brain', body: 'Aether remembers what matters to you and connects it into a living graph of your knowledge — stored only on your device.', visual: 'memory' },
  { title: 'Just talk', body: 'Speak naturally and Aether listens, transcribes, and replies. Hands-free, on-device voice.', visual: 'voice' },
];
```

- [ ] **Step 4: Implement FeatureRow**

Create `components/ui/FeatureRow.tsx`. A visual fragment on one side, copy on the other; alternates by index. Visuals reuse chat primitives where natural; otherwise a styled mini-card.
```tsx
'use client';
import { motion } from 'framer-motion';
import { colors } from '@/lib/tokens';
import { UserBubble } from '@/components/phone/chat/UserBubble';
import { AssistantTurn } from '@/components/phone/chat/AssistantTurn';
import type { Feature } from '@/content/features';

function Visual({ kind }: { kind: Feature['visual'] }) {
  const card: React.CSSProperties = { background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 22, width: '100%', maxWidth: 420 };
  switch (kind) {
    case 'chat':
      return <div style={card}><UserBubble text="Summarize this in one line." /><AssistantTurn text="Done — entirely on your device." /></div>;
    case 'vision':
      return <div style={card}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: colors.success }} /><span style={{ color: colors.textMuted, fontSize: 13 }}>Vision active</span></div><AssistantTurn text="A golden retriever on a beach at sunset." /></div>;
    case 'research':
      return <div style={card}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, background: colors.violetDim, color: colors.violet, fontSize: 13, marginBottom: 14 }}>🌐 Research</div><AssistantTurn text="The launch is set for Q3 [1][2]." /></div>;
    case 'memory':
      return <div style={card}><div style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>Second Brain</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['Goals', 'People', 'Ideas', 'Projects'].map((t) => <span key={t} style={{ border: `1px solid ${colors.border}`, borderRadius: 999, padding: '6px 12px', fontSize: 13, color: colors.text }}>{t}</span>)}</div></div>;
    case 'voice':
      return <div style={card}><AssistantTurn text="Listening…" /><div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>{[10, 20, 14, 26, 12, 22, 8].map((h, i) => <span key={i} style={{ width: 4, height: h, borderRadius: 2, background: colors.violet, opacity: 0.8 }} />)}</div></div>;
  }
}

export function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const reversed = index % 2 === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', flexDirection: reversed ? 'row-reverse' : 'row', gap: 56, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
    >
      <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}><Visual kind={feature.visual} /></div>
      <div style={{ flex: '1 1 360px', maxWidth: 460 }}>
        <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 'clamp(28px, 4vw, 44px)', margin: 0 }}>{feature.title}</h3>
        <p style={{ color: colors.textMuted, fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>{feature.body}</p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 5: Implement Features section**

Create `components/sections/Features.tsx`:
```tsx
import { features } from '@/content/features';
import { FeatureRow } from '@/components/ui/FeatureRow';

export function Features() {
  return (
    <section style={{ padding: '120px 24px', maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 120 }}>
      {features.map((f, i) => <FeatureRow key={f.title} feature={f} index={i} />)}
    </section>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- Features`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: features section with alternating rows"
```

---

## Task 13: How It Works section

**Files:**
- Create: `components/sections/HowItWorks.tsx`, `__tests__/HowItWorks.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/HowItWorks.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { HowItWorks } from '@/components/sections/HowItWorks';

test('shows three steps', () => {
  render(<HowItWorks />);
  expect(screen.getByText(/Download the APK/i)).toBeInTheDocument();
  expect(screen.getByText(/Load a model/i)).toBeInTheDocument();
  expect(screen.getByText(/Chat, fully offline/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- HowItWorks`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `components/sections/HowItWorks.tsx`:
```tsx
import { colors } from '@/lib/tokens';

const STEPS = [
  { n: '01', title: 'Download the APK', body: 'Grab the latest build. Android only, no Play Store gatekeeping.' },
  { n: '02', title: 'Load a model', body: 'Pick a model and tap once. It downloads to your device and stays there.' },
  { n: '03', title: 'Chat, fully offline', body: 'Turn off the internet if you like. Aether keeps working.' },
];

export function HowItWorks() {
  return (
    <section style={{ padding: '120px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 'clamp(32px, 6vw, 56px)', margin: '0 0 64px' }}>How it works</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
        {STEPS.map((s) => (
          <div key={s.n}>
            <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 40, color: colors.violet }}>{s.n}</div>
            <h3 style={{ fontSize: 22, margin: '12px 0 8px' }}>{s.title}</h3>
            <p style={{ color: colors.textMuted, lineHeight: 1.6 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- HowItWorks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: how-it-works section"
```

---

## Task 14: Dummy SignupForm + DiscordButton

**Files:**
- Create: `components/ui/SignupForm.tsx`, `components/ui/DiscordButton.tsx`, `__tests__/SignupForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/SignupForm.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupForm } from '@/components/ui/SignupForm';

test('rejects invalid email', async () => {
  render(<SignupForm />);
  await userEvent.type(screen.getByPlaceholderText(/email/i), 'not-an-email');
  await userEvent.click(screen.getByRole('button', { name: /notify me/i }));
  expect(screen.getByText(/valid email/i)).toBeInTheDocument();
});

test('shows success state on valid email (dummy, no network)', async () => {
  render(<SignupForm />);
  await userEvent.type(screen.getByPlaceholderText(/email/i), 'beta@aether.app');
  await userEvent.click(screen.getByRole('button', { name: /notify me/i }));
  expect(await screen.findByText(/you're on the list/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- SignupForm`
Expected: FAIL.

- [ ] **Step 3: Implement SignupForm** (dummy — validates, fake success, no network, stores nothing)

Create `components/ui/SignupForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { colors } from '@/lib/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'done'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setStatus('error'); return; }
    setStatus('done'); // dummy: nothing is sent or stored
  };

  if (status === 'done') {
    return <p style={{ color: colors.success, fontSize: 17 }}>You&apos;re on the list — we&apos;ll email you the beta APK.</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 480 }}>
      <input
        type="email"
        placeholder="your email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
        style={{ flex: '1 1 240px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: 999, padding: '13px 18px', color: '#fff', fontSize: 15 }}
      />
      <button type="submit" style={{ background: colors.violet, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 24px', fontWeight: 600, cursor: 'pointer' }}>
        Notify me
      </button>
      {status === 'error' && <p style={{ flexBasis: '100%', color: colors.violet, fontSize: 14, margin: 0 }}>Please enter a valid email.</p>}
    </form>
  );
}
```

- [ ] **Step 4: Implement DiscordButton**

Create `components/ui/DiscordButton.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function DiscordButton() {
  return (
    <a
      href="https://discord.gg/sYEhDHjDXe"
      target="_blank"
      rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: `1px solid ${colors.border}`, borderRadius: 999, padding: '13px 24px', color: '#fff', textDecoration: 'none', fontWeight: 600 }}
    >
      Join the AetherLabs community on Discord
    </a>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- SignupForm`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dummy newsletter signup + discord button"
```

---

## Task 15: CTA section, SiteNav, Footer

**Files:**
- Create: `components/sections/Cta.tsx`, `components/ui/SiteNav.tsx`, `components/ui/Footer.tsx`, `__tests__/Cta.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Cta.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Cta } from '@/components/sections/Cta';

test('cta section has #beta anchor and signup', () => {
  const { container } = render(<Cta />);
  expect(container.querySelector('#beta')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Cta`
Expected: FAIL.

- [ ] **Step 3: Implement Cta**

Create `components/sections/Cta.tsx`:
```tsx
import { Aurora } from '@/components/aurora/Aurora';
import { SignupForm } from '@/components/ui/SignupForm';
import { DiscordButton } from '@/components/ui/DiscordButton';
import { colors } from '@/lib/tokens';

export function Cta() {
  return (
    <section id="beta" style={{ position: 'relative', padding: '160px 24px', overflow: 'hidden', textAlign: 'center' }}>
      <Aurora intensity={0.8} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 'clamp(36px, 7vw, 68px)', margin: 0, letterSpacing: '-0.02em' }}>
          Get the beta
        </h2>
        <p style={{ color: colors.textMuted, fontSize: 19, marginTop: 16 }}>
          Drop your email for the beta APK, or jump straight into the community.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, marginTop: 36 }}>
          <SignupForm />
          <DiscordButton />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement SiteNav** (sticky, slim, appears after hero)

Create `components/ui/SiteNav.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function SiteNav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', backdropFilter: 'blur(12px)', background: 'rgba(28,28,28,0.6)', borderBottom: `1px solid ${colors.border}` }}>
      <a href="#top" style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 22, color: '#fff', textDecoration: 'none' }}>Aether</a>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', fontSize: 14 }}>
        <a href="#mission" style={{ color: colors.textMuted, textDecoration: 'none' }}>Mission</a>
        <a href="#features" style={{ color: colors.textMuted, textDecoration: 'none' }}>Features</a>
        <a href="#beta" style={{ color: '#fff', textDecoration: 'none', background: colors.violet, padding: '8px 16px', borderRadius: 999 }}>Beta</a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Implement Footer**

Create `components/ui/Footer.tsx`:
```tsx
import { colors } from '@/lib/tokens';

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${colors.border}`, padding: '40px 24px', textAlign: 'center', color: colors.textMuted, fontSize: 14 }}>
      <p style={{ margin: 0 }}>Aether by AetherLabs · {new Date().getFullYear()}</p>
      <p style={{ margin: '8px 0 0' }}>
        <a href="https://discord.gg/sYEhDHjDXe" style={{ color: colors.textMuted }}>Discord</a>
      </p>
    </footer>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- Cta`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: cta section, site nav, footer"
```

---

## Task 16: Compose the page + section anchors

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/page.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

test('page composes hero, mission, features, cta', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: 'Aether' })).toBeInTheDocument();
  expect(screen.getByText(/No datacenters/i)).toBeInTheDocument();
  expect(screen.getByText(/On-device AI/i)).toBeInTheDocument();
  expect(screen.getByText(/Get the beta/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- page`
Expected: FAIL (current page is the placeholder).

- [ ] **Step 3: Compose the page**

Replace `app/page.tsx`:
```tsx
import { Hero } from '@/components/sections/Hero';
import { ChatReplay } from '@/components/phone/ChatReplay';
import { Mission } from '@/components/sections/Mission';
import { Features } from '@/components/sections/Features';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { Cta } from '@/components/sections/Cta';
import { conversation } from '@/content/script';

export default function Home() {
  return (
    <main id="top">
      <Hero />
      <section style={{ position: 'relative' }} aria-label="Aether in action">
        <ChatReplay beats={conversation} />
      </section>
      <div id="mission"><Mission /></div>
      <div id="features"><Features /></div>
      <HowItWorks />
      <Cta />
    </main>
  );
}
```

- [ ] **Step 4: Add SiteNav + Footer to layout**

In `app/layout.tsx`, import and place `<SiteNav />` before `{children}` and `<Footer />` after, inside `<body>`:
```tsx
import { SiteNav } from '@/components/ui/SiteNav';
import { Footer } from '@/components/ui/Footer';
// ...
<body style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
  <SiteNav />
  {children}
  <Footer />
</body>
```

- [ ] **Step 5: Run tests**

Run: `npm test -- page`
Expected: PASS.

- [ ] **Step 6: Run full suite + build**

Run: `npm test && npm run build`
Expected: all tests PASS, production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: compose full landing page"
```

---

## Task 17: Manual verification + polish pass

**Files:** none (manual), then targeted fixes

- [ ] **Step 1: Run dev server and view**

Run: `npm run dev` and open `http://localhost:3000`.
Check:
- Hero aurora drifts smoothly; SCROLL cue visible.
- Scrolling past hero pins the phone; conversation types/streams and rewinds cleanly on scroll up.
- Aurora inside phone surfaces while streaming.
- Mission, Features (alternating rows fade in), How It Works render.
- Signup: invalid email → error; valid → success state (no network call in devtools).
- Discord links open `https://discord.gg/sYEhDHjDXe`.

- [ ] **Step 2: Verify reduced-motion**

In devtools, emulate `prefers-reduced-motion: reduce`. Confirm: aurora static, phone shows finished conversation (no scrubbing), no blinking.

- [ ] **Step 3: Lighthouse**

Run Lighthouse (devtools) on the built site (`npm run build && npm start`). Target ≥95 performance, 100 a11y. Fix any flagged contrast/alt/label issues inline.

- [ ] **Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "polish: verification fixes"
```

---

## Task 18: Deploy to Vercel

**Files:** none

- [ ] **Step 1: Push to GitHub**

Create the remote repo (gh) and push:
```bash
cd /home/xcrr1/aether-website
gh repo create aether-website --public --source=. --remote=origin --push
```

- [ ] **Step 2: Deploy**

Either connect the repo in the Vercel dashboard, or use the Vercel MCP `deploy_to_vercel` tool from this session. Framework preset: Next.js. No env vars needed (dummy form).

- [ ] **Step 3: Verify production URL**

Open the deployed URL, repeat the Task 17 Step 1 checks on the live site.

- [ ] **Step 4: Record the URL**

Add the production URL to `README.md` and commit.

---

## Self-Review notes (coverage vs spec)

- Visual system (§2) → Task 3 (tokens), Task 4 (fonts), Task 5 (aurora/grain). ✓
- IA hero/phone/mission/features/how/cta (§3) → Tasks 10, 9, 11, 12, 13, 15. ✓
- Interactive phone mechanism (§4) → Tasks 6–9 (primitives, timeline, replay, sticky scroll). ✓
- Reduced-motion (§4, §6) → globals.css (Task 3), useReducedMotion (Task 4), ChatReplay fallback (Task 9 Step 6), TypingDots/Aurora media queries. ✓
- Tech & structure (§5) → Tasks 1–2; file layout matches. ✓
- Dummy newsletter (§3.6, §7) → Task 14 (no network, stores nothing). ✓
- Discord link `https://discord.gg/sYEhDHjDXe` → Hero, DiscordButton, SiteNav, Footer. ✓
- Performance/a11y (§6) → Task 17. ✓
- Deploy Vercel (§5) → Task 18. ✓

Type consistency: `Beat`/`TimelineState`/`resolveTimeline` defined Task 7, consumed Tasks 8–9, 16. `Feature` defined Task 12, consumed in same task. `colors`/`spacing`/`radius` defined Task 3, used throughout.
