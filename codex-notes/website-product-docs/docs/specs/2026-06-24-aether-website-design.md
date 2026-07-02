# Aether — Website Design Spec

**Date:** 2026-06-24
**Owner:** AetherLabs
**Product:** Aether — sovereign, local-first AI assistant for Android
**Goal:** A single-page, dark, scroll-driven marketing site that feels like a hand-crafted art piece — zero AI-slop. Shows the app in motion, explains features in plain language, states the mission (no datacenters, no surveillance), and converts via a newsletter beta signup + Discord community.

---

## 1. Principles

- **Hand-made, not generated.** No stock glows, no generic SaaS gradients, no default template smell. Every motion is hand-tuned.
- **Show, don't tell.** The hero is a *living* recreation of the real app that types and replies as you scroll.
- **Restraint.** Mostly near-black. Violet used sparingly as the single accent. Whitespace is the luxury.
- **Honest.** Plain-language feature copy; no buzzword inflation. The app runs on-device — say exactly that.
- **Fast & accessible.** GPU-only animation, self-hosted fonts, `prefers-reduced-motion` fully honored.

## 2. Visual system (ported verbatim from the app's `src/theme/index.ts`)

| Token | Value | Use |
|---|---|---|
| `bg` | `#1C1C1C` | page background (warm near-black, **not** pure black) |
| `bgCard` / `bgInput` | `#252525` | cards, input fields, assistant bubble surface |
| `border` / `separator` | `#2E2E2E` | hairline dividers |
| `text` | `#FFFFFF` | primary text |
| `textMuted` | `#8E8E8E` | secondary / labels |
| `violet` | `#7C3AED` | primary accent, user bubble, send button, CTAs |
| `violetStrong` | `#6D28D9` | pressed/hover accent |
| `violetDim` | `rgba(124,58,237,0.14)` | active pill background |
| aurora blobs | `#7C3AED`, `#5B21B6`, `#9333EA` | drifting background gradient |
| `success` | `#22C55E` | "Vision active" dot |

**Typography:** Playfair Display (headers, editorial display) + Inter (body, UI). Self-hosted woff2. Matches the app's `fonts.display` / `fonts.sans`.
- Hero / section headers: Playfair Display, large, tight tracking.
- Body, labels, UI chrome: Inter 400/500/600/700.
- The recreated app UI uses Inter exactly as the app does.

**Radii / spacing:** mirror app tokens — radius `sm 8 / md 12 / lg 16 / xl 24 / full 999`; spacing `4 / 8 / 12 / 16 / 24 / 32`.

**Aurora backdrop:** three soft radial violet blobs drifting + scaling on 11s/13s/12s loops (ported from `Aurora.tsx`), plus a radial vignette (`cx 50% cy 40% r 70%`, fade to `bg` at edges). On web: large blurred `radial-gradient` divs animated via CSS `@keyframes` on `transform` only. A film-grain SVG/PNG overlay at low opacity kills banding and the "AI gradient" look.

**Motion language:** ease `cubic-bezier(0.22,1,0.36,1)` (out-expo-ish) for entrances; durations 120/220/900ms tiers mirroring app `motion` tokens. Nothing bounces gratuitously.

## 3. Information architecture (single page, top → bottom)

1. **Hero**
   - Playfair wordmark "Aether" + one-line manifesto (e.g. "Your AI. On your phone. Nowhere else.").
   - Aurora breathing behind. Subtle scroll cue.
   - Primary CTA *Join the beta* (scrolls to signup) + secondary *Discord*.
   - Sticky slim top nav appears after hero: wordmark · Features · Mission · Beta · Discord.

2. **The interactive phone** (the showpiece — see §4)
   - A phone frame pinned (`position: sticky`) while a tall scroll track passes.
   - The real chat UI, rebuilt in HTML/CSS, plays a scripted conversation as you scroll: user message slides in → "Aether" typing dots → reply streams token-by-token → markdown renders → aurora surfaces while "thinking." Several beats.

3. **Mission** (manifesto, two pillars)
   - **No datacenters.** Every reply runs on your phone. No servers burning electricity for your conversations. (environmental angle)
   - **No surveillance.** Nothing you type leaves the device. No accounts, no logging, no training on you. (privacy angle)
   - Big Playfair statements, generous space, one quiet supporting line each.

4. **Features** (alternating rows — UI snippet + plain copy)
   - On-device AI (offline, private, yours).
   - Vision — show it a photo, it sees. (faithful "Vision active" badge snippet)
   - Web research with citations (the Research toggle + sourced answer).
   - Second Brain — a memory graph of what matters to you.
   - Voice — talk to it.
   Each row: a hand-built UI fragment (reusing the recreated components) on one side, headline + 2–3 sentence plain-language copy on the other; sides alternate.

5. **How it works** (3 honest steps)
   - Download the APK → Load a model (one tap) → Chat, fully offline.

6. **CTA / footer**
   - Newsletter signup (beta APK announcements): email field + button. **Dummy for now** — validates format, shows a faux success state, stores nothing (no backend wired). Built so a real endpoint drops in later.
   - Discord button → `https://discord.gg/sYEhDHjDXe`.
   - Footer: "Aether by AetherLabs", year, minimal links.

## 4. The interactive phone — mechanism

**Approach:** faithful HTML/CSS recreation of the app's chat screen (chosen over literal screenshots so text can actually type and stream). Components ported 1:1 from app source:

- **User bubble** — solid violet `#7C3AED`, right-aligned, `maxWidth 82%`, radius `lg` with `borderBottomRightRadius sm`, white 15px Inter / 22px line-height. (from `MessageBubble.tsx`)
- **Assistant turn** — *no bubble*, bare text on `bg`, muted "Aether" label (12px, letter-spacing 0.2) above, markdown body. (Claude-style, from `MessageBubble.tsx`)
- **Typing indicator** — three dots while content is empty (port `TypingIndicator`).
- **Input bar** — `#252525` rounded `xl` field, "Message Aether" placeholder, "+" pill on the left, circular violet send button with up-arrow; footer line "Aether is an AI and can make mistakes. Replies run on-device." (from `ChatInput.tsx`)
- **Aurora** surfaces (fades in) while "thinking", dissolves at rest — mirrors the app's `active` behavior.

**Driver:** scroll position → a deterministic animation timeline.
- Phone is `sticky`; a tall spacer track defines scroll length. Library: Framer Motion `useScroll`/`useTransform` (preferred) or GSAP ScrollTrigger.
- Scroll progress is divided into **beats**. Each beat: reveal user bubble → pause → typing dots → stream assistant reply character-by-character with a blinking caret → settle.
- A scripted conversation (3–4 exchanges) showcasing: a normal chat reply, a markdown answer (list/code), and a research/vision beat.
- **Replayable & deterministic** — scrolling up rewinds cleanly.
- **`prefers-reduced-motion`:** no typing/scrubbing; show the finished conversation statically, aurora static.

Streaming text is purely presentational (pre-written script revealed progressively) — no real model, no network.

## 5. Tech & structure

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Animation:** Framer Motion (scroll + reveals); GSAP ScrollTrigger only if a beat needs finer scrubbing.
- **Fonts:** self-hosted Playfair Display + Inter via `next/font/local` (woff2). No external font CDN.
- **Repo:** new repo `aether-website` (separate from `aether-mobile`).
- **Deploy:** Vercel.
- **Tokens:** a single `tokens.css` / Tailwind theme extension holding the exact app colors above — one source of truth.
- **Components (web):** `<Aurora>`, `<PhoneFrame>`, `<ChatReplay>`, `<UserBubble>`, `<AssistantTurn>`, `<TypingDots>`, `<InputBar>`, `<FeatureRow>`, `<MissionPanel>`, `<SignupForm>` (dummy), `<DiscordButton>`, `<SiteNav>`, `<Footer>`.

### Proposed file layout
```
aether-website/
  app/
    layout.tsx            # fonts, metadata, <SiteNav>, <Footer>
    page.tsx              # composes all sections
    globals.css           # tokens + base
  components/
    aurora/Aurora.tsx
    phone/PhoneFrame.tsx
    phone/ChatReplay.tsx          # scroll-driven timeline
    phone/chat/{UserBubble,AssistantTurn,TypingDots,InputBar}.tsx
    sections/{Hero,Mission,Features,HowItWorks,Cta}.tsx
    ui/{FeatureRow,SignupForm,DiscordButton,SiteNav,Footer}.tsx
  content/script.ts        # the scripted conversation beats
  lib/tokens.ts            # exported color/spacing constants
  public/fonts/*           # self-hosted woff2
  public/grain.png         # film-grain overlay
```

## 6. Performance & accessibility

- Animate only `transform` / `opacity`. No layout thrash on scroll.
- `prefers-reduced-motion`: aurora static, conversation shown finished, no scroll scrubbing.
- Semantic headings, alt text, focus states on CTAs/inputs, AA contrast (violet on `bg` for text used carefully — large/decorative only).
- Lighthouse target: 95+ performance, 100 a11y/best-practices.
- Lazy-mount the heavy phone replay; respect data-saver where possible.

## 7. Out of scope (v1)

- Real newsletter backend / email storage (dummy form now; wire Buttondown/Supabase/Formspree later).
- iOS content (Android-only app).
- Blog, docs, multi-page routing, i18n.
- Analytics (can add privacy-friendly later).

## 8. Open items / assumptions

- Hero manifesto copy and exact feature wording to be finalized during build (placeholders provided, easy to tune).
- Domain TBD (Vercel default until a custom domain is chosen).
- Discord link: `https://discord.gg/sYEhDHjDXe` (confirmed).
