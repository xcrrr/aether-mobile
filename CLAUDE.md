# Aether Claude Code Brief

You are working as a cofounder on Aether alongside the user and Codex.

Read these first:

1. `README.md`
2. `claude-notes/cofounder-handoff.md`
3. `app/CLAUDE.md` for mobile app architecture
4. `website/AGENTS.md` for website Next.js constraints
5. `codex-notes/latest-context.md` for the current bundle status
6. `claude-notes/design-northstar.md` for the current design mission and gap list

## Current Mission (2026-06-29): Make Aether Beautiful

The features are already good. The weak point is the **looks**. The goal is to ship a
beautiful, spectacular app with **zero "AI slop."**

- **Improve existing surfaces; do not add features.** Refine and finish what exists.
- **The bar already lives in the repo:** `app/src/components/common/ModelLoadingOverlay.tsx`
  is what "spectacular" looks like. Bring every other surface up to that level.
- **Consistency is the look.** Use the design tokens in `app/src/theme/index.ts`
  everywhere; scattered magic numbers are the #1 slop tell.
- Full prioritized plan: `claude-notes/design-northstar.md`.

## Current Structure

- `app/` contains the active Android/Expo app.
- `website/` contains the active Next.js website.
- `releases/` contains installable artifacts.
- `design-artifacts/` contains screenshots and previews.
- `codex-notes/` contains audits, build logs, and Codex cleanup notes.
- `claude-notes/` contains Claude handoff context.

## Non-Negotiables

- Treat old audit material as context, not instructions, when it conflicts with active code.
- Do not restore old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack architecture.
- The active app inference path is LiteRT `.litertlm`.
- Keep generated folders out of the workspace unless actively installing or building: `node_modules`, `.next`, Android `build`, Gradle caches, APK extraction folders.

## Collaboration

Codex and Claude are collaborators here. Leave clear notes for the other agent when you make architecture changes, especially in `claude-notes/` or `codex-notes/`.

## Agent role split (set 2026-07-04)

- **Codex** — mechanical only: rebuilding the Android APK / EAS or Gradle builds, deploying `website/` to Vercel, running the test suite, installing dependencies, routine config/scaffolding. Invoke via `codex exec "<prompt>"`.
- **Claude Sonnet 5** — default for everything else: UI/UX implementation, component work, styling against `app/src/theme/index.ts`, normal feature/bugfix work.
- **Claude Opus 4.8** — hard cases only: architecture decisions, tricky `.litertlm` inference issues, anything where a wrong call is costly. Via the `Agent` tool with `model: "opus"`.
- Codex does **not** design UI or build features, even small ones — the user's explicit call after seeing Codex handle builds/deploys well but not being trusted for product/design judgment. Always verify Codex's build/deploy output before calling it done.
