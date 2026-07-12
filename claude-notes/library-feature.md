# Library (kept Task outputs) — handoff

Added a local **Library** surface: user keeps completed Task outputs, opens them
later, exports as real files. Fully on-device. No backend, no accounts, no sync.

## Source of truth
Single store = `taskStorage.ts` `ARTIFACTS_KEY` (`@aether/agent-artifacts`,
AsyncStorage). Reused, not duplicated. `useLibraryStore` is a reactive mirror
(hydrate/keep/rename/remove/get) that writes through to taskStorage. Hydrated on
startup in `app/_layout.tsx`.

## Data
`AgentArtifact` extended with optional `type` / `updatedAt` / `sourceConversationId`
(backward-compatible; legacy records still parse, `type` defaults to `document`).

## Flow
`AgentTaskCard` `ArtifactBlock` now: **See** (transient full-screen reader),
**Keep** (idempotent by artifact id, awaits persistence before success, Retry on
failure), **Download** (export sheet, works before/after Keep). After Keep →
`Kept ✓` + `Open in Library` (routes straight to the detail screen).

## Export — `src/library/export.ts`
- TXT / MD: pure JS, written via SAF.
- PDF: **real** PDF via `expo-print` (`printToFileAsync` → base64 → SAF file).
  `expo-print@~14.0.3` added — **needs a Gradle rebuild** to link the native module;
  until then PDF returns `unavailable` honestly (TXT/MD unaffected).
- Destination: SAF `requestDirectoryPermissionsAsync` (folder picked once, remembered
  in `@aether/library-export-dir`) → `createFileAsync`. No broad storage permission.
- Only user-visible artifact content is exported. No Core, no prompts, no research internals.

## Not done / deferred
- APK not rebuilt, not run on device. PDF-on-device unverified (needs rebuild).
- No rename UI (store supports it; detail title is display-only, no fake edit mode).
- No folders/tags/filtering (Library v1 = flat list).
