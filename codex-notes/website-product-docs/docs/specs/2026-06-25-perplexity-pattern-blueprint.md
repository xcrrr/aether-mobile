# Perplexity Pattern Blueprint — Comet + Computer

Source pages studied: `perplexity.ai/comet` (Studio Freight / Darkroom build) and
`perplexity.ai/products/computer` (Perplexity Computer launch).

**Legal stance:** we copy *structure, layout, motion patterns* — NOT their copy, images,
or video. Every caption, color, font, and asset is ours. This is a pattern map, not a
content lift.

## Their design DNA (what makes it look premium)

- **Scroll = narrative.** Comet site is a continuous story: space → Earth. Seamless
  video loops (no hard cuts), masked "windows" reveal transitions between cosmic and
  earthbound footage. Anti-sci-fi: drew from *2001: A Space Odyssey*, not NASA posters.
  Composition + restraint over flashy.
- **Serif to soften tech.** Primary display face is **PP Editorial New** (serif).
  Counter-move against cold AI/sci-fi feel. Body in a grotesk (FK Grotesk).
- **Living typography.** Variable-weight headlines that **expand on hover** —
  "stretches and reshapes," nods to expansion + responsiveness.
- **Palette:** white + blue, generous negative space, rounded corners, soft iconography.
- **Texture contrast:** clean AI-generated space imagery vs grainy real clips of work /
  nature / invention → frames product inside human discovery.

## Our translation (different colors/fonts/captions, same skeleton)

| Their token | Ours |
|---|---|
| PP Editorial New (serif display) | **Playfair Display Variable** (already installed) |
| FK Grotesk (body) | **Inter** (already installed) |
| white + blue | Aether palette (aurora/purple — keep our brand) |
| space→Earth video narrative | Aurora + on-device intelligence narrative |
| variable-weight hover headline | Playfair variable weight on hover (framer-motion) |

Stack already in repo: **Next 16 + framer-motion + lenis (smooth scroll) + Tailwind 4**.
Lenis = the seamless-feel scroll. framer-motion `useScroll`/`useTransform` = the
scroll-driven video/mask reveals. Everything below is buildable with what's installed.

---

## Section-by-section build map

### 1. Header / Nav (sticky, minimal)
- Logo left, single primary CTA right ("Download" → for us "Get Aether" / APK link).
- Transparent over hero, gains bg blur on scroll.
- **Ours:** `components/ui/SiteNav.tsx` — add scroll-progress bg blur (lenis scroll value
  → opacity). Magnetic CTA already exists (`MagneticButton`).

### 2. Hero — single bold claim + product visual
- Their copy pattern: one short headline ("A new browser from Perplexity") +
  one-line subhead + platform line + one CTA + large product visual.
- **Ours:** keep our phone-mockup hero (`HeroStage`/`PhoneFrame`). Headline in Playfair
  variable; on hover, weight animates up. Subhead Inter. Phone shrinks on scroll
  (already done). Caption = our value prop, not theirs.

### 3. Scroll-narrative spine (THE signature move — add this)
- This is what makes their site award-tier and we don't fully have it yet.
- A full-bleed sticky section whose background video/visual **transforms as you scroll**.
  Masked windows wipe between two visuals. No hard cuts; loops reversed+blended.
- **Ours (aurora narrative):** sticky `100vh` wrapper, inner visual driven by
  `useScroll({ target })` → `useTransform` to drive a CSS mask / clip-path reveal +
  cross-fade between two looping `<video>`/canvas aurora states (e.g. "cosmic noise" →
  "focused on-device"). Reuse `components/aurora/Aurora.tsx` as the animated layer;
  drive its params from scroll progress instead of time.
- Build notes: preload both loops, `playsInline muted loop`, `object-fit:cover`. Mask
  via `clip-path: inset()` or an SVG/`mask-image` animated by scroll. Test placement on
  mobile (their hardest part was "precise browser-based placement across devices").

### 4. Capability grid — "Do anything with X" (6 cards)
- Their pattern: section title + 6 cards, each = a category label + a real example
  prompt + supporting image. ("AI that understands / builds / emails / creates / shops".)
- **Ours:** `components/sections/Features.tsx` + `FeatureRow`/`FeatureDemo` already
  here. Map to Aether's real powers: on-device chat, web research w/ citations, vision
  scan, voice, second-brain memory, files. Each card shows a **live animated demo**
  (we already have research source-counter, vision scan, knowledge graph, voice
  waveform, on-device stream — `FeatureDemo.tsx`). This beats static images.

### 5. "Explore more ways" bridge CTA
- Short tagline + two links to deeper pages + large promo image. Low-commitment.
- **Ours:** thin band linking to docs / getting-started. Optional for v1.

### 6. Personal-assistant / deep feature section
- Headline + description + **embedded video demo** + grid of ~11 small feature images.
- **Ours:** the "agent does the work" story → our second-brain + research pipeline.
  Use a screen-recording of the app, surrounded by a dense feature-icon grid.

### 7. Computer-page pattern — "the system is the worker"
From `perplexity.ai/products/computer` (Perplexity Computer). Section themes in order:
1. **Intro / positioning** — one big claim ("AI is now the computer").
2. **How it works** — workflow → tasks → sub-agents → parallel execution diagram.
3. **Natural evolution** — lineage/mission framing.
4. **Multi-model orchestration** — capability list.
- **Ours:** a "How Aether works" explainer with an **animated pipeline diagram**
  (prompt → on-device model → research/vision/memory tools → answer). framer-motion
  staggered reveal as it scrolls into view. We already have `HowItWorks.tsx` — upgrade
  it into this animated pipeline.

### 8. FAQ — collapsible accordion
- 6–8 questions (platforms, install, privacy, pricing, safety).
- **Ours:** standard `<details>`/accordion, Inter, generous spacing. Aether angle =
  privacy / fully on-device / no backend (our actual differentiator).

### 9. Closing CTA — repeat the hero promise
- Big headline restating value + final download CTA + feature images + footer.
- Their footer tagline is a tiny poetic line ("cosmic curiosity").
- **Ours:** `components/sections/Cta.tsx` + `Footer.tsx`. End on a one-line Aether
  motto. Social links, legal.

---

## Priority order to feel like them

1. **Scroll-narrative spine (§3)** — biggest premium signal, missing today.
2. **Variable-weight hover headlines (§2)** — cheap, high-impact, Playfair already there.
3. **Lenis everywhere + scroll-driven reveals** — the "seamless" feel.
4. **Live-demo capability cards (§4)** — we already beat their static images; lean in.
5. **Animated how-it-works pipeline (§7)**.

## Don't copy
- Their exact words, images, video, blue palette, PP Editorial/FK Grotesk licenses.
- Sci-fi clichés — they deliberately avoided them; so do we (aurora ≠ NASA poster).
