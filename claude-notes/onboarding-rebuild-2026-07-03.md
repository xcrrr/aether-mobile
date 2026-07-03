# Onboarding + legal gate rebuild (2026-07-03)

Full first-run experience rebuilt per Adam's brief. Old onboarding replaced, not patched.

## New sequence (`app/app/onboarding/index.tsx`)

1. **Welcome** — Aether intro + local-first positioning, combined into one screen.
2. **Core** — new `CoreGrowthVisual` (constellation nodes stagger-grow around a
   center glyph, then settle into a slow breath). "Your Core grows with you."
3. **Model setup** — Fast (E2B) / Thinking (E4B) picker cards. Selecting only records
   a choice — no network call yet.
4. **Research & Task** — two honest capability cards. Task is labeled Beta.
5. **Ready** — name (optional, folded in rather than its own screen) + legal doc
   links + Accept/Not now. This is the single terminal gate.

**Legal moved from first screen to last.** Old flow blocked on beta terms before any
product context. New flow explains the product first, then gates entry — nothing
sensitive happens before that point, so this is safe, and it reads far less like a
wall of legal text on first launch. On Accept: profile is saved, beta terms accepted,
model download kicked off (only if not already installed), then routed to `/(main)`.

**Returning users** whose beta-terms version bumped still get a short, separate
`TermsReacceptanceGate` (same file) — they never see the full 5-screen tour again,
only a compact re-accept screen. This preserves the old short-circuit behavior.

## Legal gate fix (`app/src/components/legal/LegalDocumentModal.tsx`)

Root cause of "can't scroll to the bottom": RN's `<Modal>` renders into its own
native root on Android, outside the app-level `GestureHandlerRootView` in
`app/_layout.tsx` — a documented RNGH caveat that breaks touch/scroll gestures
inside modals. Fixed by re-wrapping the modal's content in its own
`GestureHandlerRootView`, adding top+bottom `SafeAreaView` insets (footer/last
paragraph were sitting flush against system bars with no clearance),
`statusBarTranslucent`, and an explicit bottom spacer view in the ScrollView.

## Legal copy (`app/src/legal/documents.ts`)

Added a "Limitations & liability" section to Closed Beta Terms — beta software, use
at own risk, developer not responsible for device/data issues to the maximum extent
permitted, still requires legal review (kept the existing `DRAFT_REVIEW_NOTICE`
honesty pattern, no overconfident claims). AI Safety Notice is now also linked from
the onboarding Ready screen (previously only reachable from Settings' Legal Center).

## Model download UX

Home empty state (`app/app/(main)/index.tsx`) previously dead-ended on "Get a
model" with no awareness of an in-flight download. It now shows a `ProgressBar`
when a download kicked off from onboarding (or resumed via `reattachDownloads`,
now also called here on mount, matching Settings) is active.

## Delegation

Fable 5 built `app/src/components/onboarding/CoreGrowthVisual.tsx` (the one
motion-critical piece) against a tight contract (Animated + react-native-svg only,
theme tokens, reduce-motion parity with `ModelLoadingOverlay`). Everything else —
flow architecture, legal fixes, copy, model/download wiring — done directly.

## Verified

`npm run typecheck` (0 errors) and `npm test` (500/500) both green after the change.
Not yet verified on a real device — no on-device screenshot pass done this session.

## Follow-up / open item

No device verification yet. Also: the old onboarding asked for an optional "goal /
project" field (second profile step) — dropped intentionally, since asking users to
pre-declare context up front fights the "Core learns from real use" story. If that
field is still wanted somewhere, it belongs in Settings, not onboarding.
