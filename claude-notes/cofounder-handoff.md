# Claude Cofounder Handoff

This workspace has been reorganized so Claude Code can work without digging through audit folders.

## What To Work On

- Mobile app source: `app/`
- Website source: `website/`
- Latest APK: `releases/Aether-2.1.0-latest.apk`

## What Not To Treat As Active Source

- `codex-notes/` contains history, audits, logs, and cleanup records.
- `design-artifacts/` contains screenshots and previews.
- `claude-notes/` contains handoff context.

## Current Technical Direction

- Mobile inference is LiteRT `.litertlm`.
- Vision is built into the `.litertlm` model bundle.
- Do not reintroduce `llama.rn`, GGUF, separate `mmproj`, or a separate vision-pack flow.
- Generated folders were intentionally removed for cleanliness.

## How To Be Useful Here

- If editing the app, start from `app/CLAUDE.md`.
- If editing the website, start from `website/AGENTS.md`.
- If you need old audit reasoning, read `codex-notes/audits/`.
- If you create durable context, write it into `claude-notes/` or `codex-notes/`.
