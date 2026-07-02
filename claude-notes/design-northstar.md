# Aether Design North-Star

Owner: Claude Code (cofounder). Audience: Adam + Codex.
Created: 2026-06-29.

## Target: clone the Claude mobile app (verified 2026-06-29)

We are intentionally cloning the look of Anthropic's Claude app, with **violet** as our
accent instead of Claude's terracotta. Verified facts about Claude's design:

- **Type:** body/UI = Styrene B (sans); serif = Tiempos Text; big headers = Galaxie
  Copernicus. **Claude renders assistant replies in SERIF**, full-width, no bubble, no
  avatar, ~1.65 line-height. → Our Literata-serif assistant body + bare text is CORRECT.
- **Color:** light cream `#faf9f5`, warm dark `#141413`/`#191919`, accent orange `#d97757`.
  Our warm dark `#1C1C1C` + warm-paper light match the shape; violet is our deliberate swap.
- **Surfaces:** flat, **minimal shadow**, editorial, spacious.

**Decisions locked:**
- KEEP serif assistant body (matches Claude).
- KEEP the Aurora — it is a *thinking indicator* (`active={isGenerating}` only), not an
  always-on background. Subtle and purposeful. Do NOT remove.
- NO shadow/elevation roll-out — Claude is minimal-shadow. (shadow tokens exist only for
  the floating mode-selector menu, which is fine.)
- The app is already a structurally faithful Claude clone; remaining work is rhythm/
  restraint, not new chrome.

Sources: mobbin.com/colors/brand/claude, loftlyy.com/en/anthropic, type.today/en/journal/anthropic,
assistant-ui.com/examples/claude.

## The mission

Ship a **beautiful, spectacular** Aether. Zero "AI slop." The features are already
good — the looks are the weak point. **We improve and finish existing surfaces; we do
not add features.** Every screen should feel hand-crafted and intentional.

## The bar already exists in our own repo

`app/src/components/common/ModelLoadingOverlay.tsx` is what "spectacular" looks like:
a hand-built animated planet with atmosphere, light scatter, breathing + drift loops,
a final dissolve. It is custom, alive, and unmistakably *ours*.

**Goal: bring every other surface up to that bar.** When a screen feels flat or
templated, that is the gap.

## Honest assessment (2026-06-29)

The codebase is well-architected and the design *system* is thoughtful (Claude-style
warm dark + warm-paper light, single violet accent, Literata serif for the assistant's
editorial voice, Inter for UI, the Aurora backdrop). The problem is **inconsistent
finishing**, not bad taste. Concretely:

1. **Tokens exist but are bypassed.** `src/theme/index.ts` defines `spacing`, `radius`,
   `fontSize`, `lineHeight`, `motion`. Components routinely hardcode magic numbers
   instead — e.g. `borderRadius: 12/14` literals in the sidebar vs `radius.md`, font
   sizes `19/24/25/36` that ignore the `fontSize` scale, paddings `9/11/14/18`. Result:
   subtly inconsistent rhythm across screens. This is the single biggest "slop" tell.
2. **No elevation language.** Everything is a flat rectangle with a 1px border. Premium
   apps layer subtle shadow/depth. We have none — cards, inputs, bubbles all read flat.
3. **Almost no micro-interaction.** Motion tokens (`pressOpacity`, `disabledOpacity`,
   durations) exist but most `Pressable`s give no press feedback — no scale, no opacity,
   no haptic. Aliveness on touch is the #1 thing separating "crafted" from "slop."
4. **Sparse empty / home states.** `app/(main)/index.tsx` and the chat `EmptyState` are
   bare centered text + tiny logo on a dark void (Aurora is off at rest). Feels empty,
   not premium. These are first-impression surfaces.
5. **Settings & sidebar are functional but plain.** Generic segmented control, flat
   model rows, no hierarchy beyond uppercase labels. Fine — but not "spectacular."
6. **Light theme is unverified for polish parity.** Warm paper looks promising in tokens;
   needs a real on-device pass to confirm it's as finished as dark.

## Prioritized goals (do in order)

### Goal 1 — Token discipline pass (foundation)
Audit every component; replace magic numbers with `spacing`/`radius`/`fontSize`/
`lineHeight` tokens. Where a needed value is missing from the scale, add it to the scale
rather than hardcoding. This makes everything else consistent for free.

> **Status (2026-06-29): fontSize sub-pass DONE.** Type scale consolidated to one ramp in
> `src/theme/index.ts` (17 ad-hoc sizes → clean ramp: micro/xs/sm/sm2/base/body/md/lg +
> xl/xxl/display/hero/brand). 110 literals across 25 files now reference tokens. Headings
> unified (19/21→20, 25→24, ≤1px). `ModelLoadingOverlay` left untouched (the reference).
> Verified: `npm run typecheck` 0 errors, `npm test` 207/207. **Remaining: radius + spacing**
> adoption — some values are off-scale and need design calls + on-device QA before snapping.

### Goal 2 — Elevation + a shared press/interaction layer
Add a light, tasteful shadow/elevation token set and apply it to cards, the chat input,
and the send button. Introduce one shared pressable primitive (or a hook) that gives
every tappable surface consistent press feedback (scale ~0.97 + opacity) and, where
appropriate, light haptics. Roll it across buttons, pills, rows, the send button.

> **Status (2026-06-29): press layer DONE.** New `src/components/ds/PressableScale.tsx` —
> drop-in Pressable that springs (scale+fade via `motion.pressScale/pressFade/durFast`)
> and can fire a light haptic. Rolled into ds/Button, ChatInput (send+plus+action pills),
> ConversationRow, SidebarContent (Core/Settings/New chat), ModeSelector (trigger+items),
> settings (back+theme segment), onboarding (nav arrows). Haptics on primary actions only
> (send, new chat, onboarding next, primary Button). Added `shadow` tokens (sm/md/lg) to
> theme; ModeSelector menu uses `shadow.lg`. Verified `npm run typecheck` 0 + `npm test`
> 207/207. **Not yet checked on a real device.** Remaining: roll `shadow` onto cards/sheets
> (most visible in light theme), and consider press feel on the few remaining bare
> Pressables (chat header icons, attachment sheet rows).

### Goal 3 — Elevate the first-impression surfaces
Home (`(main)/index.tsx`), chat `EmptyState`, and onboarding. Make the void feel
intentional: a quiet always-on Aurora at low intensity, a more crafted greeting/logo
lockup, subtle entrance motion. These are what a new user judges in the first 5 seconds.

### Goal 4 — Finish settings, sidebar, second brain to the bar
Hierarchy, spacing rhythm, model rows that feel like product, depth on cards.

### Goal 5 — Light-theme + on-device QA pass
Run on a real device, screenshot every surface in both themes, fix parity gaps. Capture
into `design-artifacts/`.

## Working principles

- **Match the bar, not the average.** Before shipping a surface, ask: does this feel as
  crafted as the model-loading screen?
- **Consistency is the look.** A coherent token system applied everywhere reads as
  "designed"; scattered magic numbers read as "generated."
- **Motion with restraint.** Subtle, fast (120–220ms), purposeful. No bouncy gimmicks.
- **Improve, don't add.** If you're reaching for a new feature, redirect to finishing an
  existing one.
- **Verify visually.** Code-correct ≠ beautiful. Screenshot on a real device.

## Note to Codex

If you touch UI, please respect the token system (Goal 1) — don't add new magic numbers.
Leave handoff notes here or in `codex-notes/` when you change anything visual.
