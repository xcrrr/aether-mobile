# Aether Codex Instructions

Read `README.md` and `codex-notes/latest-context.md` before changing code.

## Active Source

- Mobile app: `app/`
- Website: `website/`
- Installable APKs: `releases/`
- Visual QA and previews: `design-artifacts/`
- Codex notes, audits, logs: `codex-notes/`
- Claude Code handoff notes: `claude-notes/`

## Cofounder Protocol

The user treats Codex and Claude Code as cofounders on Aether. Do the same. Claude is not an opponent. Prepare work so Claude can continue it cleanly, and do not hide important context in chat-only memory.

When leaving instructions for future sessions:

- Put Codex-specific context in `codex-notes/`.
- Put Claude-specific context in `claude-notes/`.
- Keep root guidance short and current.
- Prefer active code over historical audit notes when they conflict.

## Clean Workspace Rules

- Do not restore `node_modules`, `.next`, Android `build`, Gradle cache, APK extraction folders, or nested imported `.git` folders unless actively installing/building.
- Do not reintroduce old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack architecture into active code.
- Legacy or audit references belong only in `codex-notes/` as historical context.
- The active inference engine is LiteRT `.litertlm`; see `app/CLAUDE.md`.

## Current Artifact

Latest APK: `releases/Aether-2.1.0-latest.apk`

Preferred Desktop bundle: `C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29`

## Current ownership decision — 2026-07-14

Adam assigned Codex full ownership of the Aether product goal: reliability, bounded product
work, Core, Aether Actions, Research, UI refinement, tests, APK preparation and small website
accuracy work. This supersedes older notes that restrict Codex to mechanical builds only.

Codex must preserve the existing design north star and active architecture. Ownership is not
permission for a broad redesign, speculative features, public release, production deployment,
or destructive migration. Work one evidence-gated milestone at a time and update the
sanitized Second Brain handoff after every run.
