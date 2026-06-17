# Aether Mobile — Design System Implementation

**Date:** 2026-06-17
**Goal:** Implement the "Aether Mobile App.html" design system (a Claude-design web
prototype) into the real `aetherbeta` Expo/React Native app so it **looks the same
and works the same**, while preserving the app's real on-device `llama.rn` inference,
model downloads, persistence, and navigation.

## Source of truth

The HTML prototype bundles a design system (`AetherSystem_5adcc1`) plus a UI kit
(`aether-mobile`). Both were *derived from this app's* `src/theme/index.ts`, so the
color tokens already match. The prototype is web (HTML/CSS/React-DOM); we re-create
its visual language in React Native primitives. Extracted reference lives in
`/tmp/aether_assets/` during implementation; the canonical tokens are reproduced below.

## Design tokens (port into `src/theme/index.ts`)

Colors (existing values kept, names extended):
- `bg #0B0B0F`, `bgCard #16161D`, `assistantBubble #1C1C24`, `border #26262F`
- `text #F5F5F7`, `textMuted #9A9AA8`, `textCode #E2E2E2`
- `violet #7C3AED`, `violetStrong #6D28D9`, `blue #4285F4`
- `danger #EF4444`, `dangerBg #2A1414`, `black #000`, `white #fff`
- `scrim rgba(11,11,15,0.96)`

Typography:
- `fontSans = Inter`, `fontDisplay = Playfair Display`, `fontMono = system mono`
- Scale: 11,12,13,14,15,16,18,28,32. Weights 400/500/600/700/800.
- Display/serif used for: onboarding slide titles, profile-step titles, chat
  empty-state greeting ("Hello, {name}").

Spacing `4/8/12/16/24/32`; radius `sm8/md12/lg16/xl24/full999`; hit target 44.

## Fonts

Add `expo-font` + `@expo-google-fonts/inter` and `@expo-google-fonts/playfair-display`.
Load weights used (Inter 400/500/600/700/800; Playfair 600/700/800) in the root
`app/_layout.tsx` via `useFonts`, gate render until loaded (with existing splash).
Expose font-family names through the theme as `fonts.sans`/`fonts.display`/`fonts.mono`.

## Brand assets

Add `assets/logo-purple.png` and `assets/logo-white.png` (432×432 RGBA, the violet "Λ"
caret mark) extracted from the prototype. Used in onboarding, sidebar header, chat
empty state, assistant avatar, and loading overlay.

## Reusable DS components (new, in `src/components/ds/`)

Faithful RN ports of the prototype's kit, theme-driven:
- `Logo` — image mark, optional wordmark (Inter 800, -0.02em).
- `Badge` — pill; tones `neutral|accent|blue|danger` (translucent fills + borders).
- `Button` — variants `primary|secondary|danger`, sizes `sm|md|lg`, `block`, press
  opacity 0.7, disabled 0.45. Replaces current `common/Button`.
- `ProgressBar` — dark track + violet fill, optional `label`/`meta` row.
- `Aurora` — animated blurred violet blobs drifting + hue shift over black, with a
  vignette. RN port using `react-native-reanimated` (already implied by Expo) or
  `Animated` loops; three radial-gradient blobs via `expo-linear-gradient`/`react-native-svg`
  radial gradients. (Implementation note: use `react-native-svg` RadialGradient blobs
  animated with `Animated.loop` translate/scale; hue-shift approximated by cross-fading
  blob colors. This is the one place we approximate rather than match pixel-for-pixel.)

## Screen-by-screen changes

### 1. Onboarding (`app/onboarding/*`) — biggest change
Replace the current 2-screen name/goals stack with a single animated flow matching the
prototype: **3 intro slides → name → goals**.
- Intro slides over `Aurora`: brand mark in a soft radial halo, uppercase kicker
  (`#C9A9FF`), optional large "Aether" wordmark (slide 1), Playfair title, muted body.
- `NavRow`: circular back chevron (fades when unavailable), animated dot indicator
  (active dot widens to 22px, violet), circular forward/primary button.
- "Skip" jumps to the name step.
- Name step (required) → Goals step (skippable). Both write to `useProfileStore`
  (`name`, `goal`) exactly as today; `goal` feeds the system prompt (unchanged wiring).
- Slide-in entry animation per phase (`translateY` + opacity).
- Implemented as one Expo Router screen (`app/onboarding/index.tsx`) holding phase
  state, replacing `name.tsx`/`goals.tsx`. `app/index.tsx` redirect target updated to
  `/onboarding`.

### 2. Chat (`app/(main)/chat/[id].tsx` + components)
- **Custom header** (hide drawer header for this route): hamburger (opens drawer) ·
  centered "Aether" wordmark with **ModeSelector** dropdown beneath · settings gear.
- **ModeSelector**: "Fast" (Gemma 4 E2B) / "Thinking" (Gemma 4 E4B) dropdown matching
  the prototype (violet dot, chevron, animated menu with model + size + desc). Per the
  decision, selecting a mode **switches the active model** (`useModelStore.setActive`):
  - If the mode's model is **downloaded** → set active; if a chat is open it reloads
    against the new model (existing `useInference`/overlay handles the load).
  - If **not downloaded** → route to Settings (so the user can download it), leaving the
    current mode unchanged. A short inline note in the menu marks undownloaded modes.
  - The selector reflects the current `activeModelId` (e2b→Fast, e4b→Thinking).
- **Empty state**: logo (48px) + Playfair "Hello, {name}" + muted privacy line.
- **MessageBubble**: assistant messages gain the circular logo **avatar** + "Aether"
  label above a left-aligned `bgCard`-bordered bubble; user messages stay violet,
  right-aligned. Markdown rendering preserved (`MarkdownView`).
- **TypingIndicator**: keep, restyle to the 3-dot staggered-fade pill (already close).
- **Composer (`ChatInput`)**: `bgCard` rounded field + 44px circular send/stop button
  (send = up-arrow SVG, stop = square), disabled state greys the button; footer line
  "Aether is an AI and can make mistakes. Replies run on-device."

### 3. Sidebar (`SidebarContent`)
Reorder + restyle to match prototype: logo+wordmark header → **Model** section using
`ModelSelectRow`s (the two models, dot accent, selected = violet border/name, tapping
sets active) → "+ New chat" outlined row → **Conversations** list (active row =
`assistantBubble`, 2-line title/preview) → settings footer "⚙ Settings & Storage".

### 4. Settings (`app/(main)/settings.tsx` + components)
- Section labels (uppercase, tracked).
- `Device storage` card: "X GB used / total" + segmented `StorageBar` (per-installed-model
  colored segments + "Other apps"/used remainder), legend below. Reuse real disk values
  from `MM.totalBytes/freeBytes/installedBytes`; per-model segment sizes from registry.
- `Models`: each model in a card with `Badge` (Recommended=accent / Most capable=blue),
  description, and state-driven controls: Download / progress+Cancel / "Downloaded"+Delete
  — wired to existing `useModelStore.download/cancel/remove` and progress.
- Footer note about Hugging Face one-time download / offline / no telemetry.

### 5. Model loading overlay (`common/ModelLoadingOverlay`)
Restyle to the prototype's card: rotating conic-gradient arc ring + glow halo around the
logo, big violet tabular `%`, model name, gradient progress bar, cycling status line.
Driven by real load progress where available; keep the existing faux-ease timing as the
visual fallback (llama.rn load is not granular). Ring/glow via `react-native-svg` +
`Animated` rotation.

## Navigation / layout
- `app/(main)/_layout.tsx`: keep `Drawer`, but set `headerShown: false` for `chat/[id]`
  (custom header) and style the drawer to host the new `SidebarContent`. Home (`index`)
  and Settings get a minimal custom header (back/menu + title) or keep a restyled drawer
  header consistent with tokens.
- Drawer width 300, `bgCard` background, right border — already configured.

## What stays exactly the same (no behavior change)
- `llama.rn` inference, streaming, stop (`useInference`, `LlamaService`).
- Model download/cancel/delete/reattach, persistence (`ModelManager`, stores, storage).
- Conversation create/open/persist (`useChatStore`), profile persistence.
- Model registry (ids, urls, sizes). Mode↔model mapping is additive only.

## Out of scope / approximations
- The prototype's canned demo replies and seeded conversations are **not** ported — the
  real app uses live inference and real stored conversations.
- Aurora and the overlay ring are **visual approximations** in RN (no CSS blur/conic on
  all targets); they match intent, color, and motion, not exact pixels.
- No new fonts beyond Inter + Playfair Display.

## Testing
- Existing Jest suite must stay green (`npm test`); update tests touching changed
  component APIs (e.g. `Button` props, onboarding screens).
- Add unit tests for: mode↔model resolution (e2b/e4b ↔ Fast/Thinking, undownloaded
  routing), `StorageBar` segment math, onboarding phase progression (skip, back, required
  name gate).
- Manual: launch via the documented Gradle/Expo flow; verify onboarding flow, mode switch
  with one model installed, empty-state greeting, settings download/delete, loading overlay.

## Implementation order
1. Tokens + fonts + logo assets + `Screen` base.
2. DS primitives (`Logo`, `Badge`, `Button`, `ProgressBar`, `Aurora`).
3. Onboarding flow.
4. Chat (header, ModeSelector, empty state, bubbles, composer, overlay).
5. Sidebar + Settings.
6. Tests + manual verification.
