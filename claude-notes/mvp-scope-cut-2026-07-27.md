# MVP scope cut — Task hidden from the product (2026-07-27)

Adam's decision. The shipped MVP is **Chat + Core + Research + images/files + voice**.
Task (the local agent) is no longer reachable anywhere in the app. Nothing was deleted.

## Why

Not a quality judgement on the kernel. Task is the surface with the most device-unverified
behaviour, and a first beta is judged by whatever is least finished in it. Holding it back
lets Core and Research — the two features that differentiate Aether — carry the release on
their own, and gives Task the device verification it has not had yet.

The second reason is narrower: a feature still awaiting verification is not a sound basis
for a paid tier.

## How it was done

One flag, `TASK_UI_ENABLED` in `app/src/release/features.ts`, currently `false`. It controls
visibility only, never the kernel. Flip it to `true` to dogfood Task on a local build without
branching the repo.

Adam explicitly asked for the code to stay in place, so `src/agent/` is untouched: 20 source
files, 8 test suites, all still compiled under strict TypeScript and still running on every
`npm test`. That is the whole point of the flag — a long-lived branch or a second repo would
have let this code rot within weeks, and the merge back would have cost more than the feature.

Note this is a deliberate exception to `app/CLAUDE.md`'s "no feature flags" rule. That rule
exists to stop compatibility cruft accumulating; a single release gate with a defined removal
condition is a different thing. It should be deleted — in one direction or the other — once
Task's device verification has actually run.

## Touch points

- `app/(main)/chat/[id].tsx` — stops passing `onAct` / `actMode` / `onToggleAct` to `ChatInput`.
  `ChatInput` already derived `taskAvailable` from `!!onToggleAct`, so the Task row drops out
  of `ModeMenu` on its own. That seam already existed; nothing new was invented for it.
- `src/components/sidebar/SidebarContent.tsx` — Library entry hidden. Library has no source of
  artifacts without Task.
- `app/(main)/library/index.tsx` and `library/[id].tsx` — redirect to `/(main)` when the flag is
  off, so a deep link cannot reach a dead surface. Guards sit after all hooks.
- `app/onboarding/index.tsx` — phase 3 drops the Task capability card and its title changes from
  "Two modes, used on purpose" to "One mode". `PAGE_COUNT` is unchanged; the phase still exists,
  it just describes Research alone.

## Deliberately left alone

`MessageBubble` still renders `AgentReceiptCard` for historical messages that already carry a
receipt. With Task unreachable no new ones can be created, so this is inert for any fresh
install, but it stops existing conversations on Adam's device from rendering blank. Say the word
if you want old receipts hidden too.

`expo-print` is still a dependency. It exists for artifact PDF export, which is now unreachable,
so it could come out for a smaller APK — but that is a native-linking change needing a Gradle
rebuild to verify, and no Android toolchain is available on the Linux laptop. Worth doing on a
machine that can build.

`markInterruptedTasks()` still runs at startup and the Library/export stores still hydrate. All
no-ops against empty data. Not worth special-casing.

## State

Strict typecheck clean. Jest 47 suites / 600 tests pass at commit `611e8b4` plus this change.
Nothing was verified on a device — this change removes UI, so the risk is low, but the MVP
surfaces it leaves behind have still never been device-tested. That is the next task and it
gates everything else.
