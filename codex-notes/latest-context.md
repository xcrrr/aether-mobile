# Aether Latest Context

Date saved: 2026-06-29

This is the cleaned Aether workspace from the June 2026 audit/update pass.

## Current Clean Structure

- Mobile app source: `app/`
- Website source: `website/`
- Latest APK artifact: `releases/Aether-2.1.0-latest.apk`
- Visual previews and screenshots: `design-artifacts/`
- Codex notes, audits, logs, and cleanup records: `codex-notes/`
- Claude Code handoff notes: `claude-notes/`

## What "Newest Aether" Means Here

This workspace includes the latest known Aether app and website work from the audit/update pass:

- Full audit context preserved in `codex-notes/audits/`.
- Large mobile update pass, including Core/design work and model-loading redesign artifacts.
- Autoscroll behavior changed/turned off where applicable.
- Responsiveness fixes for the app/website work captured in the update pass.
- Latest installable APK in `releases/`.

## Cleanliness Rules

Generated dependency/build folders and duplicate APK extraction folders were intentionally removed:

- `node_modules`
- `.next`
- Android `build`
- Android `.gradle`
- Android app `.cxx`
- APK extract/compare folders
- Nested imported `.git` metadata

Do not restore these unless actively installing/building.

## Important Caveat

Do not describe every audit item as completed. `codex-notes/audits/aether-audit-gap-list-2026-06-28.md` says a large part of the core/design pass was implemented, but some audit items were still open, including missing real Android verification in this local environment.

## Desktop Copy

Preferred Desktop workspace:

`C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29`

As of the 2026-07-02 cleanup, loose Desktop Aether APKs, zip files, previews, and older Aether folders were intentionally removed. Keep installable artifacts in `releases/`; the only retained APK should be:

`releases/Aether-2.1.0-latest.apk`

Do not recreate quick-install APK copies on the Desktop unless the user explicitly asks.

## APK Build Note

For future Windows APK builds, use `codex-notes/android-apk-build-playbook.md`. The last successful build used a short clean copy at `C:\a2` because building directly from the Desktop workspace can fail in CMake/Ninja on long React Native native-module paths.

Latest APK build log: `codex-notes/apk-build-2026-07-03-claude-upgrade.md`.
