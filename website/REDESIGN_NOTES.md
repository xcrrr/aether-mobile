# Aether Website Redesign Notes

Date: 2026-07-02. Owner: Claude Code. Full ground-up rebuild of the landing experience.

## Concept

An editorial, dark-gray-first product site. One idea carried through the whole page:
**Aether is a private assistant that runs on your phone; online is a choice.**
The quality comes from typography, pacing, and a believable product demo — not from
gradients, particles, or space theatrics. The previous cinematic direction (planet hero,
starfield, flying-phone warp handoff, Playfair Display) was removed entirely.

## Narrative structure (top to bottom)

1. **Nav** — wordmark, 3 anchor links, one beta CTA. Sticky, blurred gray.
2. **Hero** — "The assistant that stays on your phone." + scoped supporting copy, 2 CTAs,
   3 factual proof points. Pure editorial; the product appears one scroll later.
3. **PhoneStory** (sticky demo, preserved concept) — pinned phone, conversation streams
   with scroll, captions swap beside it. 3 exchanges: offline chat → Core memory → the
   Research boundary.
4. **Premise** — "Why local-first" manifesto: three beliefs on hairlines.
5. **Memory** — Core explained + a restrained Core panel visual (reuses the demo's gate
   code for narrative continuity).
6. **Capabilities** — six editorial rows (modes, vision, voice, documents, research,
   actions). No icon grid, no cards.
7. **Boundaries** (ink) — the complete on-device vs. over-the-network list. The page's
   trust centerpiece.
8. **BetaCta** (ink) — "It's early. That's the point." Discord + APK.
9. **Footer** (ink) — wordmark, links, one line.

The page now uses a single dark-gray surface.

## Design principles

- **One dark gray surface.** Background `#2B2B2B`, with scoped variables left in place
  for later section-level variations. Sections can still flip via the `.ink` class which
  rescopes the CSS variables (`--bg/--text/--muted/--line/--accent`).
- **The app's real typography.** Newsreader (serif, editorial voice) + Instrument Sans
  (UI) — identical to the mobile app's font system. Self-hosted variable woff2 in
  `public/fonts/`. Playfair and Inter were removed.
- **Violet is an accent, never a wash.** Eyebrows, dots, focus rings. No aurora, no
  gradient backgrounds anywhere.
- **Hairlines, not cards.** Lists sit on 1px rules; the only "cards" are inside the
  product visuals (phone screen, Core panel), where they mirror the real app.
- **Motion earns its place.** Scroll-driven conversation, one quiet `Reveal` rise-in per
  section, caption crossfades. Nothing loops, nothing floats.

## Sticky phone implementation

`components/sections/PhoneStory.tsx`:

- Section is `340vh`; inner viewport is `position: sticky; top: 0; height: 100vh`.
- `useScroll` (framer-motion) → progress quantized to 1/300 steps to limit re-renders.
- Progress maps to conversation time with dead zones (5% lead-in, 8% hold at the end) so
  the phone settles before/after the exchange.
- `resolveTimeline` (`components/phone/useTypewriter.ts`, kept from the old site) turns
  progress into shown beats + a streaming slice; user beats appear whole, assistant beats
  stream with a caret, preceded by typing dots.
- Captions render stacked & absolutely positioned with an invisible sizer reserving the
  tallest caption's height → zero layout shift as they crossfade.
- Phone is the fixed 360×740 mock scaled via a `--phone-scale` custom property set by
  width/height media queries; the wrapper box takes the scaled footprint so the grid
  never overflows.
- The phone mock (`components/phone/*`) mirrors the current app: bare serif assistant
  turns with a muted name label, quiet dark user bubbles (not violet — matches
  `MessageBubble.tsx`), "Fast" mode chip, "Message Aether" input, disclaimer line.

### Mobile behavior

Below 920px the sticky grid stacks: scaled-down phone on top (~0.58, still legible at
16px serif), eyebrow + caption below it. Same scroll mechanics, same script. Below 640px
height the phone drops to 0.5. No pinch-shrunken desktop layout.

### Reduced motion

`useReducedMotion` swaps the whole section for a static variant: full conversation at
progress 1 plus the captions as a readable list. Global CSS also zeroes animation and
transition durations. Covered by `__tests__/PhoneStory.test.tsx`.

## Product claims — sources and guardrails

Used (implementation-backed):

| Claim | Source |
| --- | --- |
| Model runs on the phone; replies generated on-device | LiteRT `.litertlm` engine, `app/CLAUDE.md` |
| Works without a connection once a model is installed | on-device inference; model download is the online step |
| No account, no Aether server/backend | app has no backend (`app/CLAUDE.md` "no backend") |
| Conversations stored on the phone | Zustand + AsyncStorage persist, local only |
| Core memory readable/editable/deletable | `src/secondbrain/`, Core screen |
| Fast / Thinking modes | `src/models/registry.ts` MODES (gemma E2B / E4B) |
| Image understanding in the same model | multimodal `.litertlm`, no separate vision pack |
| PDF/Word text extracted on the phone | `src/files/` FileProcessor |
| Research: optional, online, cited, user-initiated | `src/webresearch/` DuckDuckGo→fetch→cite |
| Voice dictation via Android speech service, may use network | `@react-native-voice/voice` wraps Android SpeechRecognizer |
| Agent Actions early/beta | Actions V2 shipped, device validation pending |

Intentionally avoided: "100% private/offline", "nothing ever leaves your device",
"no cloud", "fully secure", user counts, testimonials, benchmarks, launch dates,
certifications. `__tests__/script.test.ts` and `__tests__/page.test.tsx` contain regex
guards that fail the suite if absolute claims reappear.

## Preserved from the old site

- The **sticky scroll phone conversation** concept (rebuilt: no flying-phone handoff, no
  warp, no stage glow).
- The phone chat kit skeleton (`PhoneFrame`, chat components, `resolveTimeline`) —
  restyled to match the current app.
- `useReducedMotion`, jest setup, framer-motion mock, Next/Tailwind build stack.
- Discord/GitHub links (release link now points at `releases/latest`).

Removed: cinematic hero (planet, starfield, comets), Aurora/Starfield components,
FlyingPhone/HeroStage handoff choreography, MagneticButton, SignupForm (validated email
into nowhere — no backend exists), Compare table, Community/Mission/Features/HowItWorks
sections, lenis smooth scroll, Playfair/Inter fonts, fontsource deps.

## Known limitations / assets still needed

- **No OG/social preview image.** `layout.tsx` metadata is ready for one; add
  `opengraph-image.png` (1200x630, dark gray bg + wordmark) when available.
- **No favicon refresh** — still the default `app/favicon.ico`; replace with the Aether
  mark.
- Boundaries list is hand-maintained; if the app gains a networked feature (e.g. update
  checks), the list must be updated to stay honest.
- Real device screenshots of the polished app (from `design-artifacts/`) could later
  replace/augment the reconstructed Core panel.
- LightningCSS (Next 16 Turbopack) strips `color: var(--text)` on `.ink` as redundant —
  worked around with a literal hex; keep in mind when adding scoped-variable color rules.

## Manual QA checklist

- [x] Desktop hero: Newsreader renders, eyebrow violet, CTAs focusable
- [x] Sticky demo desktop: phone pins, conversation streams, captions crossfade, no
      layout shift, settles before Premise
- [x] Sticky demo mobile (375px): stacked layout, phone legible, captions below
- [x] Page surface: light text on #2B2B2B, ghost button transparent
- [x] No horizontal overflow at 375px
- [x] No console errors/warnings
- [x] Reduced motion: static conversation variant (jest-verified)
- [x] `npm test` 21/21, `npm run build` clean, `npx eslint .` clean
- [ ] Real-device Android Chrome pass (not possible in this environment)
- [ ] Lighthouse run on a deployed build

## Commands

```bash
cd website
npm install
npm run dev    # http://localhost:3000
npm test
npm run build
```
