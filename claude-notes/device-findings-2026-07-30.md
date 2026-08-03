# What the first real device session found (2026-07-30)

Adam installed 2.2.1 on the S25 Ultra and reported three things. All three were real, none were
visible to the test suite or to a typecheck, and two of them were shipped by code that had never
run on a phone.

## The pattern worth remembering

Every defect here lived in a **gap between two correct-looking pieces**:

- a field that renders correctly but cannot receive focus,
- a hit-test whose per-node tolerance is computed and then discarded by the condition below it,
- a renderer whose colours are internally consistent but belong to a different theme than the
  screen hosting it.

Nothing here would fail a unit test, because in each case both sides were individually right.
That is the argument for the device checklist, not for more tests.

## 1. The name field could not raise the keyboard

`onboarding/index.tsx` changed by 341 lines after the 2.1.0 APK was built, and nothing had run it
on hardware since. The rewrite dropped `autoFocus` from the name input. With it, the keyboard came
up on its own and nobody ever had to hit the field; without it, the field had to be tapped, and
tapping did not focus it.

Adam's own follow-up narrowed this precisely — typing worked everywhere except that one field —
which is what confirmed it was the field and not the app's input handling.

Also fixed alongside: `KeyboardAvoidingView` used `behavior="padding"` on Android while the
manifest sets `windowSoftInputMode="adjustResize"`. The window is already resized for the
keyboard, so the padding applied that height a second time. `behavior` is now iOS-only.

## 2. Core nodes could not be tapped

Three independent faults, each survivable alone, fatal together.

```js
var bestD = 28 * 28;
var tolerance = Math.pow(18 + baseRadius(n) * 1.7, 2);
var limit = Math.max(bestD, tolerance);
if (d < limit && d < bestD) { ... }
```

`limit` is dead. The condition still requires `d < bestD`, and `bestD` only ever shrinks from its
seed, so the per-node tolerance could never widen anything. Every node had the same flat 28px
reach regardless of how large it was drawn.

Second, the drag threshold used a Manhattan sum (`|dx| + |dy| > 10`), which trips at roughly 7px
on a diagonal — inside normal finger tremor.

Third, `touchend` rejected a tap if the finger had rested longer than 360ms, so aiming carefully
at a small target made it *less* likely to register.

The camera also rotated from the first pixel of movement, which moved the target during the aim.
It now holds still until the gesture passes the drag threshold.

## 3. Core carried its own theme

`knowledge-graph.scene.js` hardcoded `BG = '#181818'`, `TEXT = '#ECE8F2'` and a dark set of dim,
fade and edge colours. On the warm-paper theme that is a black rectangle in a light app; had the
ground ever matched, the near-white labels would have been invisible. Even on dark it drew
`#181818` against the app's `#1C1C1C`, which reads as a seam around the WebView.

The scene now takes the palette through `__setTheme`, with a light variant for dimmed nodes,
edges and label chips. It arrives via `injectedJavaScriptBeforeContentLoaded` so it is applied
before the first frame rather than after it.

**Both caches have colour baked in** — label textures are drawn on a canvas, node materials are
keyed by colour — so `__setTheme` drops both and rebuilds. Forgetting either leaves stale colours
on a theme switch.

`MemoryGraphView`'s own chrome was hardcoded dark too and now follows `useColors`.

Separately, the eight category colours all sat between 50% and 60% lightness at very low chroma,
so they read as one brownish grey. Hues are separated and chroma lifted, held near 62% lightness
so the same values work on both themes.

## Haptics, added in the same pass

A tick while a reply streams, modelled on ChatGPT's. Two findings shaped it.

It runs on a **timer for the whole generation**, not per token. A token is often a few characters,
so token-driven feedback fires far faster than a motor can answer, and it goes silent whenever the
model pauses — including the gap before the first character, which is exactly when feedback is
wanted.

And it is **switchable**, because ChatGPT's continuous vibration is the most complained-about
thing in its mobile app, to the point that OpenAI ships a switch. The setting is read on each tick
rather than captured at the start, so turning it off silences a reply already in flight.

Note for future work: `expo-haptics` is 14.0.1 here, which predates
`performAndroidHapticsAsync` — the API the current Expo docs recommend over the Vibrator on
Android. When the SDK moves, that is the better call.

## Still not verified

Everything above is reasoned from the reports and the source. None of it has been re-confirmed on
the device. An emulator was installed on the laptop and can run a throwaway `-PaetherAbis=x86_64`
build for UI work, but the machine rebooted mid-session and that verification never completed.

Adam has also asked for Core's visual redesign to go further than this. What landed is the scene,
the palette, the theme and the interaction. The Core screen's own chrome — top bar, list panel,
detail sheet — is untouched and is the remaining work.
