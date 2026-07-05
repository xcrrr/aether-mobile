# Artifact PDF download — shared export pipeline (2026-07-05)

## What
Unified, real artifact downloading. One user-facing format: **PDF**. One shared
pipeline every surface routes through. No format chooser, no TXT/MD paths.

## Pipeline (single source of truth)
`src/files/ArtifactExporter.ts` → `exportArtifactPdf({ id, title, content }, { onPhase })`
1. `pdfExporter.ts` — Markdown → HTML (`markdownHtml.ts`) → real PDF via **expo-print** (cache).
2. Validate non-empty PDF.
3. `saveToDownloads.ts` — save to public Downloads via **SAF** (expo-file-system
   `StorageAccessFramework`). Scoped, no broad permission. Folder granted once,
   persisted in AsyncStorage (`KEYS.downloadsTreeUri`), reused silently.
4. `artifactNotifier.ts` — **expo-notifications** system-bar notifications
   (preparing/saving → "PDF ready" + Open action / failure). **expo-sharing**
   opens the PDF. All best-effort; JS state always present via `useExportStore`.

Filenames: `Aether - <title> - <YYYY-MM-DD>.pdf`, sanitized, Unicode-safe,
collision-suffixed `(2)` (`artifactFilename.ts`).

## In-app state
`src/state/useExportStore.ts` (mirrors `useModelStore`). Always surfaces phase +
toast even when notifications are denied. Lazy-requires the native pipeline.

## UI
`components/chat/AgentTaskCard.tsx` `ArtifactBlock` — added **Download PDF**
action (phase-aware: Download PDF → Preparing… → Saving… → Open / Retry). This is
the only artifact surface today; it covers both Action-result drafts and kept
("Library") artifacts (`saved` flag). No separate Library screen / chat-file
download exists in the code — pipeline is centralized so any future surface reuses it.

## Native additions (REQUIRE APK REBUILD)
package.json + app.json: `expo-print`, `expo-notifications`, `expo-sharing`.
All first-party Expo Modules (Expo Modules API → no NativeModules-null patch
needed under bridgeless). `expo-notifications` plugin added. POST_NOTIFICATIONS
already declared; withAetherAndroid dedups perms.

Rebuild: `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`
(after `npx expo prebuild` if manifest/plugin changes need regenerating).

## Verified by Claude
`tsc --noEmit` clean. `npx jest` → 521 passed / 41 suites. New tests:
markdownHtml, artifactFilename, ArtifactExporter (happy/empty/cancel/fail/dedupe).
**Not device-verified** — native modules need the rebuild above + on-device QA
(notification tap/Open, SAF folder grant, Polish filename, no-viewer fallback).
