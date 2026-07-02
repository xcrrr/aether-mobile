# Aether Cleanup Log

Date: 2026-06-29

This cleanup removed files and folders that were verified as generated output, dependency installs, duplicate APK extracts, local tool state, archived legacy architecture documents, old build logs, or empty attachment shells.

## Removed Generated Or Reproducible Folders

- `app/node_modules`
- `app/.expo`
- `app/android/.gradle`
- `app/android/build`
- `app/android/app/.cxx`
- `app/android/app/build`
- `website/node_modules`
- `website/.next`
- `website/.git`
- `website/tsconfig.tsbuildinfo`

These are install/build/cache outputs or imported VCS metadata and can be recreated when needed.

## Removed Duplicate APK Extraction/Comparison Folders

- `codex-notes` source predecessor `_analysis/apk-check-latest`
- `_apk_compare`

The source APK artifact now lives at `releases/Aether-2.1.0-latest.apk`.

## Removed Archived Legacy Architecture Docs

These were deleted before the architecture reorg because each file explicitly declared itself historical/archived and described old `llama.rn`, GGUF, `mmproj`, or old native-service architecture:

- `docs/superpowers/plans/2026-06-16-aether-mobile-mvp.md`
- `docs/superpowers/plans/2026-06-23-vision-and-second-brain.md`
- `docs/superpowers/specs/2026-06-16-aether-mobile-mvp-design.md`
- `docs/superpowers/specs/2026-06-17-design-system-implementation-design.md`
- `docs/superpowers/specs/2026-06-17-second-brain-design.md`
- `docs/superpowers/specs/2026-06-23-vision-and-second-brain-design.md`

Active app source now uses LiteRT `.litertlm` bundles.

## Removed Old Logs And Empty Attachments

- `codex-notes/build-logs/`
- `codex-notes/remote-attachments/`

No active guidance referenced these logs, and the attachment folder contained no files.

## Reorganized Structure

- Active mobile app source: `app/`
- Active website source: `website/`
- Releases: `releases/`
- Visual QA artifacts: `design-artifacts/`
- Codex notes and audits: `codex-notes/`
- Claude handoff notes: `claude-notes/`

## Kept Intentionally

- Active mobile app and website source.
- Lockfiles, patches, native Android source, app assets, tests, and config files.
- Audit notes in `codex-notes/audits/` because they preserve the June 2026 audit context.
- Design screenshots and model-loading previews in `design-artifacts/`.
- Negative references that guard against the old architecture, such as "no separate vision pack" checks.

## Verification

- Required mobile and website source files were present after cleanup.
- Old `llama.rn`/`mmproj` architecture references are not active implementation files.
- Generated dependency/build folders and duplicate extraction folders are absent.
