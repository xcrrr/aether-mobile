# Aether Workspace

This is the cleaned Aether workspace from the June 2026 audit/update pass.

## Folder Map

- `app/` - Android/Expo mobile app source.
- `website/` - Next.js website source.
- `releases/` - installable release artifacts, including the latest APK.
- `design-artifacts/` - screenshots, model-loading previews, and visual QA material.
- `codex-notes/` - Codex audit notes, cleanup logs, implementation notes, and build logs.
- `claude-notes/` - Claude Code handoff notes and cofounder context.

## Start Here

- Mobile app work starts in `app/`.
- Website work starts in `website/`.
- The latest APK is `releases/Aether-2.1.0-latest.apk`.
- Current workspace context is `codex-notes/latest-context.md`.
- Initial cleanup details are in `codex-notes/cleanup/cleanup-log-2026-06-29.md`; the latest Desktop/workspace cleanup is in `codex-notes/cleanup/cleanup-log-2026-07-02.md`.

## Architecture Boundary

Active product code should live only in `app/` and `website/`. Notes, old audits, logs, screenshots, and planning docs should stay outside active source unless they are required by the build.

The active mobile model engine is LiteRT `.litertlm`. Do not bring back old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack architecture.

## Cofounder Note

The user considers Codex and Claude Code cofounders on Aether. Keep handoffs explicit, practical, and respectful of both agents. If you discover important project context, write it into `codex-notes/` or `claude-notes/` instead of relying on chat memory.
