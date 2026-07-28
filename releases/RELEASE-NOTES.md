# Release Notes — Unreleased

Covers the current `main` working tree (version `2.1.0` in `app/package.json` and `app/app.json`, unchanged versionCode/versionName), which is ahead of the only built artifact in this repo, [`Aether-2.1.0-latest.apk`](Aether-2.1.0-latest.apk). That APK reflects the source as of commit `aa89bab` (2026-07-02); everything below has landed since, either as committed history or as the current uncommitted working-tree state, and has not been built into an APK.

No new APK has been built or published for any of the work described here.

## MVP scope

The shipped MVP is **Chat, Core, Research, images and files, and voice**.

Task (a local multi-step agent) and Library (its saved outputs) are implemented and tested in `app/src/agent/` but are hidden from the app behind `TASK_UI_ENABLED = false` in `app/src/release/features.ts`. This is a scope decision, not a removal: the code stays in place and compiles, the flag controls visibility only, and Task can be dogfooded locally by flipping the flag. See `claude-notes/mvp-scope-cut-2026-07-27.md`.

## What changed since the 2.1.0 APK

Committed since the APK was built:

- Sidebar redesign; Second Brain rebranded to Core; Literata typeface; refreshed icons.
- PDF export and a Library surface for saved Task outputs landed, then hidden again by the MVP scope cut below — the code and dependency (`expo-print`) remain.
- Research illustration redesign.
- Core memory edit modal, chat input test coverage, agent/router updates.

Currently uncommitted (working-tree changes, documented in `claude-notes/*-2026-07-27.md`):

- **MVP scope cut.** Task and Library hidden from the app; nothing deleted.
- **Research overhaul.** Research now reliably delivers three sources instead of the one or two it used to settle for (search width widened, fetches read in waves, slow-but-good pages no longer treated as dead). The search layer now distinguishes "no results," "rate-limited," and "offline" instead of one generic failure message. Inline `[n]` citation markers are now real, map to numbered source cards, and are stripped only when they point at a source that doesn't exist. A live card now shows which sources are being read while research runs, and a finished answer shows its numbered sources — previously this was all plain text pushed into the chat bubble.
- **Core: visible nodes.** The knowledge graph was silently capping labels at roughly six regardless of how many facts were saved (a label-budget bug, not a node limit — every node was always rendered). Also fixed: two facts that happened to share a key were silently collapsing into one node, discarding one of them.
- **Core: extraction pass.** The known-facts block shown to the model for deduplication was capped at a fixed count taken in insertion order, so past 50 memories the model saw the oldest facts instead of the relevant ones, and could overflow the prompt entirely and silently stop extracting; it's now a relevance-ranked, character-budgeted selection. A prompt-injection path via JavaScript's `$`-substitution in `String.replace` was closed. Two silent link-dropping bugs (case-sensitive key matching, and canonicalized keys not being tracked) were fixed. Per-pass fact caps were raised from 5/3 to 7/4, since validated facts were being discarded by the cap after already passing the confidence and grounding gates.
- **Core: recall and inference tuning.** Recall matching is now lightly stemmed, so plurals and verb forms ("climbing" vs. "climb," "studies" vs. "study") match instead of missing silently. Sampling defaults changed from Gemma's creative-generation defaults (temperature 1.0 / top-k 64 / top-p 0.95) to more conservative assistant-style settings (0.7 / 40 / 0.9). The context-window budget now subtracts the system prompt's size before allocating room for conversation history, which it previously did not.
- **Two device-reported bugs fixed.** A gray screen when using the system back gesture out of Settings or Core (an empty placeholder was painted before a navigation effect resolved it — now resolved synchronously via `<Redirect>`). Chat not scrolling to the newest message after sending while scrolled up (explicit send now always scrolls to the end; passive autoscroll during streaming only follows if already near the bottom).

## Known limitations

- Nothing listed above under "currently uncommitted" has been verified on an Android device. There is no Android toolchain on the machine this work was done on (`java` is not on `PATH`), so no APK has been built to test any of it.
- The sampling change (temperature/top-k/top-p) is a considered default, not a measured improvement — it needs a side-by-side comparison on hardware before being called settled.
- Extraction quality is unmeasured: there is no fixture set of real conversations with expected extractions, so no prompt or policy change to Core's extractor can currently be shown to be better rather than just different.
- Core's automatic extraction can still be preempted by a fast follow-up message; the manual "Analyze now" action remains the reliable path.
- Voice input is still unverified on real hardware.
- As of the last recorded dependency audit (2026-07-14), the app reported 24 `npm ci` vulnerabilities (17 moderate, 6 high, 1 critical); none have been addressed and it has not been re-audited since.
- `expo-print` remains a dependency for the now-unreachable PDF export; removing it would need a native Gradle rebuild to verify, which was not available.

## Legal and signing status

- All four in-app legal documents (Closed Beta Terms, Privacy Notice, Research Disclosure, AI Safety Notice) are drafts at version `2026.07.02-draft.1` and are explicitly marked as requiring publisher/legal review before release. See `docs/aether-legal-review-required.md` for the full list of open decisions (publisher identity, jurisdiction, retention commitments, age policy, and others).
- The release build config supports signing via `android/keystore.properties`, but that file is not present in this repo. Any release APK built from this tree today falls back to the debug keystore and must not be distributed as a public release artifact.
