# Two device bugs from Adam's S25 Ultra (2026-07-27)

First real hardware findings since the beta work began. Both were reported from actual use,
not inferred from code, and both are fixed here.

## 1. Gray screen on system back out of Settings or Core

**Symptom.** Open Settings (or Core, or any non-chat drawer route), press the S25's system
back gesture, and the app shows an empty gray screen instead of returning to the last chat.

**Cause.** `app/(main)/index.tsx` is the drawer's initial route, so every back action lands
there. It rendered `<View style={styles.c} />` — a bare rectangle in `c.bg` — and relied on a
`useFocusEffect` to navigate onward to the chat. An effect runs *after* the first paint, so
that empty rectangle was always painted at least once, and any condition that made the effect
bail early (or bail before hydration finished) left it on screen permanently. The gray screen
was not a crash or a render failure; it was the intended placeholder, showing longer than
intended.

**Fix.** Resolve the hand-off during render rather than in an effect. `existingChatId` is
computed from `current?.id` falling back to the newest conversation with an installed model,
and when it exists the component now returns `<Redirect href={...} />` directly. Expo Router
processes that synchronously, so no empty frame is ever painted. The effect survives only for
the one case that genuinely needs async work — no conversation exists yet and one must be
created — and the placeholder that case shows is now the Aether logo rather than a bare
rectangle, so even that path never reads as a blank screen.

Worth knowing for future work: any route that renders nothing while an effect navigates away
will reproduce this. Prefer `<Redirect>` whenever the destination is knowable during render.

## 2. No scroll to bottom when sending after scrolling up

**Symptom.** Scroll up to read earlier messages, send a new message, and the view stays where
it was. The new turn lands off-screen below.

**Cause.** `MessageList` was a bare `FlatList` with no ref and no scroll handling of any kind.
Autoscroll had been removed wholesale at some point (noted in `codex-notes/latest-context.md`
as "autoscroll behavior changed/turned off"), which fixed streaming fighting the user but left
nothing to handle an explicit send.

**Fix.** Reintroduced scrolling in two narrowly-scoped rules rather than restoring blanket
autoscroll:

- When the last message becomes a user message — that is, on send — always `scrollToEnd`.
  Sending is an explicit request to see the newest turn and outranks wherever the reader had
  scrolled to.
- While content grows during streaming, follow the bottom *only* if the reader is already
  within 80px of it, tracked through `onScroll`. Someone who deliberately scrolled up to read
  history is left alone, which is the behaviour the original removal was protecting.

This deliberately does not restore the old always-follow behaviour. If streaming ever yanks
the view again, the `AT_BOTTOM_SLOP` threshold and the `onContentSizeChange` handler are the
two places to look.

## State

Strict typecheck clean. Jest 47 suites / 600 tests pass. Neither fix has been confirmed on
hardware — there is no Android toolchain on the Linux laptop (`java` is not on `PATH`), so
this needs an APK build and a re-run of both scenarios on the S25 before either is called
done. The reasoning for both causes is read directly from the source, but a bug reported from
a device should be closed on a device.
