# Core-to-chat P0 fix — hydration race (2026-07-03)

## Symptom
On device, a fresh chat asking "Who am I?" / "Do you know who I am?" answered
"I don't have any saved Core notes" even though Core memories are visible in the
Second Brain UI.

## Root cause
The recall/prompt/native pipeline was correct. The bug was **data timing**:

- `useInference.send()` loads the Core store lazily: `require('@/secondbrain/MemoryStore')`
  then reads `MemoryStore.getAllEntries()` **synchronously**.
- zustand `persist` rehydrates from AsyncStorage **asynchronously**.
- Nothing at app boot imports the store, so on a cold start where chat is the first
  surface to touch it, the very first send reads the store **before rehydration
  finishes** → zero entries → recall flags `profileQuery` with no notes →
  `MemoryInjector` emits the honest "no saved Core notes yet" instruction → model
  parrots it. Opening Core first hid the bug (store hydrated by then), which is why
  earlier "fixes" to the recall logic looked fine in tests but failed on device.

## Fix (one canonical path — Fast=e2b and Thinking=e4b both use `send()`)
- `secondbrain/MemoryStore.ts`: added `ensureHydrated()` (awaits
  `persist.onFinishHydration`, 1.5s cap so a reply never blocks) + `hasHydrated()`.
- `hooks/useInference.ts`: `send()` now `await MemoryStore.ensureHydrated()` before
  recall. `[CoreDebug]` trace logs `coreHydrated`.
- `agent/tools.ts`: `read_core` awaits hydration too (Task-mode parity).
- `secondbrain/recall.ts`: broadened `PROFILE_BROAD` so real phrasings route to
  profile retrieval — "Do you know who I am?", "Do you know me?", "What can you tell
  me about me?", "What does Core remember/know about me?". Negatives (recipes, "about
  React/black holes") still excluded.

## Verified
- `npx jest` → 500/500 pass (new recall + hydration tests included).
- `npx tsc --noEmit` → clean.
- Regex positives/negatives proven in Node.

## Device test after APK rebuild
1. Cold-kill app. Confirm Core shows saved notes (e.g. building Aether, climbing, local-first).
2. **Without opening Core**, open a fresh chat (Fast), ask "What does Core remember about me?"
   → must summarize only saved facts. Repeat in Thinking.
3. `adb logcat | grep CoreDebug` → coreHydrated:true, storedEntryCount>0, profileQuery:true,
   systemPromptHasCoreSection:true.
4. Disable Core → same question returns no Core facts. Delete a note → it stops appearing.

Note: deps were installed locally to run the suite (`--ignore-scripts`); rebuild still
needs the patched install (`npm ci`) so patch-package runs.
