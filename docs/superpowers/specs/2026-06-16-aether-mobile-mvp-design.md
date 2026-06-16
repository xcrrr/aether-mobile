# Aether Mobile — Beta 2 MVP Design Spec

- **Date:** 2026-06-16
- **Status:** Approved design (pending spec review)
- **Author:** Adam Parszewski (with Claude Code)
- **Supersedes:** `aether-app-mvp` (Beta 1, "aethermain") — clean rewrite, no legacy code reused

## 1. Overview

Aether is a **sovereign, local-first AI chat app for Android**. All inference runs
100% on-device via `llama.rn` (llama.cpp). No backend, no servers, no API keys,
no telemetry. The user downloads a GGUF model once, then chats fully offline.

This is **Beta 2** — a fresh, clean rewrite. We keep the *proven runtime behavior*
of Beta 1 (model download, loading, generation) but rebuild on a clean Expo Router
architecture with TypeScript strict mode and no carried-over code.

### Goals

1. Local LLM inference — works with zero internet after model download.
2. Two hardcoded Gemma 4 models, downloaded from HuggingFace CDN (GGUF Q4_K_M).
3. Clean chat UI — message bubbles, input bar, send button, streaming tokens.
4. Basic memory — onboarding profile injected into the system prompt of every chat.
5. 5-screen onboarding on first launch (name, occupation, project, goals, language).
6. Conversation history persisted locally (AsyncStorage).
7. Left sliding sidebar — conversation list, new-chat button, model selector.
8. **Settings + storage management** — Spotify-style view of device storage and
   per-model disk usage, fed by **real device data**, with model delete.
9. **A model loads on every chat open** (lazy load, with a loading overlay).

### Non-goals (YAGNI for MVP)

iOS · vision/audio (mmproj) · app-UI translation (i18n) · cloud sync / accounts ·
RAG or auto-extracted memory · multiple models loaded simultaneously ·
message edit/regenerate · markdown rendering (plain text first) · benchmarks.

## 2. Tech stack (pinned to Expo SDK 52)

| Concern | Choice |
|---|---|
| Framework | Expo SDK 52 (RN 0.76, **New Architecture on**), CNG (`expo prebuild`) |
| Language | TypeScript **strict** |
| Navigation | `expo-router` v4 (file-based) + `Drawer` for the sliding sidebar |
| Inference | `llama.rn` ~0.11.x (CPU, `n_gpu_layers: 0` on Android) |
| Downloads | `@kesha-antonov/react-native-background-downloader` ~4.5.x |
| Persistence | `@react-native-async-storage/async-storage` |
| Files / device storage | `expo-file-system` (paths, free/total disk, delete, size) |
| State | Zustand (small, no boilerplate) |
| Drawer deps | `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context` |
| Build | `expo-build-properties` (minSdk/NDK) + config plugin (arm64-v8a only) |

RN-coupled deps are installed via `npx expo install` so versions match SDK 52 exactly.

> **Decision (corrects an earlier assumption):** we do **not** rely on the GGUF's
> jinja chat template for text generation. Beta 1 proved Gemma's jinja template
> *raises on system messages*. We build the Gemma prompt manually and pass it as
> `prompt:` to `context.completion` for maximum stability.

> **Decision (corrects Beta 1):** Beta 1 used `react-native-fs` for disk stats in
> the Storage tab while using `expo-file-system` elsewhere. Beta 2 standardizes on
> `expo-file-system` only (`getFreeDiskStorageAsync` / `getTotalDiskCapacityAsync`),
> dropping the extra native dependency.

## 3. Architecture

Three clean service boundaries; UI touches them only through Zustand stores + hooks.

```
┌──────────────────────── UI (app/ — expo-router) ───────────────────────────┐
│ onboarding/ (5 steps)     (main)/  Drawer = sliding sidebar                  │
│                             ├── SidebarContent (chats · +new · model select) │
│                             ├── chat/[id]  (bubbles + input + load overlay)   │
│                             └── settings   (models · storage)                 │
└───────────────┬─────────────────────────────────────────┬──────────────────┘
                │ zustand stores                            │ hooks
   ┌────────────▼───────────┐               ┌───────────────▼──────────────┐
   │ profile / chat / model  │               │ useInference · useModelDownload│
   └───┬─────────┬─────────┬─┘               └───────────────┬──────────────┘
       │         │         │                                 │
 ┌─────▼───┐ ┌───▼──────┐ ┌▼─────────────┐        ┌──────────▼───────────┐
 │ storage/ │ │ models/  │ │ llm/          │        │ services (singletons) │
 │ Async    │ │ registry │ │ LlamaService  │        │ own native lifecycles │
 │ CRUD     │ │ Manager  │ │ + prompt      │        │                       │
 └──────────┘ └──────────┘ └───────────────┘        └───────────────────────┘
```

- **storage/** — pure AsyncStorage CRUD (profile, conversations, settings). No UI.
- **models/** — hardcoded registry + `ModelManager` (download via background-downloader,
  resume, progress, verify, delete, device-space queries). Owns the download lifecycle.
- **llm/** — `LlamaService` owns the single `LlamaContext` (init/release/generate) plus
  `prompt.ts` (profile → system prompt, message → Gemma prompt string, context trimming).

## 4. File structure

```
aetherbeta/
├── app.json                          # name, slug, android minSdk 29, plugins
├── package.json  tsconfig.json (strict)  babel.config.js  metro.config.js
├── plugins/
│   └── withArm64Only.js              # forces reactNativeArchitectures=arm64-v8a
├── assets/  (icon · splash · adaptive-icon)
│
├── app/                              # ROUTES (expo-router)
│   ├── _layout.tsx                   # boot: hydrate stores → gate onboarding vs main
│   ├── index.tsx                     # redirect based on onboarding_complete
│   ├── onboarding/
│   │   ├── _layout.tsx               # stack across the 5 steps
│   │   ├── name.tsx · occupation.tsx · project.tsx · goals.tsx · language.tsx
│   └── (main)/
│       ├── _layout.tsx               # <Drawer> with custom SidebarContent
│       ├── index.tsx                 # empty "new chat" state
│       ├── chat/[id].tsx             # one conversation (loads model on mount)
│       └── settings.tsx              # models + storage management
│
└── src/
    ├── components/
    │   ├── chat/        MessageBubble · MessageList · ChatInput · TypingIndicator
    │   ├── sidebar/     SidebarContent · ConversationRow · ModelSelector
    │   ├── settings/    ModelManagerRow · StorageBar · DownloadProgress
    │   ├── onboarding/  OnboardingStep (shared scaffold)
    │   └── common/      Button · ProgressBar · Screen · ModelLoadingOverlay
    ├── llm/
    │   ├── LlamaService.ts           # init/release context, streaming completion
    │   ├── prompt.ts                 # profile→system prompt; Gemma prompt; trimming
    │   └── types.ts
    ├── models/
    │   ├── registry.ts               # the 2 hardcoded Gemma 4 model defs (exact URLs)
    │   ├── ModelManager.ts           # download/resume/progress/verify/delete/space
    │   └── types.ts
    ├── storage/
    │   ├── keys.ts · profile.ts · conversations.ts · settings.ts
    ├── state/
    │   ├── useProfileStore.ts · useChatStore.ts · useModelStore.ts
    ├── hooks/
    │   ├── useInference.ts · useModelDownload.ts
    ├── theme/   colors.ts · spacing.ts · typography.ts
    └── types/   index.ts
```

## 5. Data model & persistence (AsyncStorage)

```ts
// storage/keys.ts
'@aether/onboarding_complete' -> "true"
'@aether/profile'             -> UserProfile (JSON)
'@aether/settings'            -> AppSettings (JSON)
'@aether/conversations_index' -> ConversationMeta[]  (JSON)
'@aether/conversation/<id>'   -> Conversation (JSON)

interface UserProfile   { name; occupation; project; goals; language }
interface AppSettings   { activeModelId: string | null }
interface ConversationMeta { id; title; modelId; createdAt; updatedAt; preview }
interface Conversation  { id; modelId; messages: Message[] }
interface Message       { id; role: 'user'|'assistant'; content; createdAt }
```

- **Per-conversation keys** (not one giant blob) — appending a message rewrites only
  that conversation; the lightweight index drives the sidebar list.
- Android AsyncStorage is SQLite-backed with a ~6 MB default; we raise it via the
  Android `AsyncStorage_db_size_in_MB` build setting (see §11).
- All reads are wrapped in try/catch and fall back to safe defaults — corrupt JSON
  must never crash the app.

## 6. Model registry (hardcoded, verified URLs)

`src/models/registry.ts` — two Gemma 4 models from **bartowski** (publicly downloadable,
no auth; same source that worked in Beta 1; sizes verified via HTTP HEAD on 2026-06-16):

| id | label | file | size | minRAM | badge |
|---|---|---|---|---|---|
| `gemma4-e2b` | Gemma 4 E2B | `google_gemma-4-E2B-it-Q4_K_M.gguf` | 3,462,678,272 B (3.46 GB) | 8 GB | **Recommended** (safe on 8 GB) |
| `gemma4-e4b` | Gemma 4 E4B | `google_gemma-4-E4B-it-Q4_K_M.gguf` | 5,405,168,384 B (5.41 GB) | 8 GB | **Most capable** (needs free RAM headroom) |

```ts
interface ModelDef {
  id: string;
  name: string;            // "Gemma 4 E2B"
  maker: string;           // "Google"
  description: string;
  sizeBytes: number;       // exact, from HF X-Linked-Size
  sizeLabel: string;       // "3.46 GB"
  minRamGb: number;        // 8
  contextLength: number;   // 131072 (model max; runtime n_ctx is 2048 — see §8)
  downloadUrl: string;     // HF resolve URL
  filename: string;        // local filename == HF filename
  color: string;           // accent for avatar
  badge: string;
}
```

Base URL pattern: `https://huggingface.co/bartowski/google_gemma-4-{E2B|E4B}-it-GGUF/resolve/main/{filename}`.

**Default selection:** E2B is the recommended/default download because a 5.41 GB E4B
plus Android overhead and KV cache is tight on an 8 GB device. Both are user-selectable.

## 7. Model download (`ModelManager`) — proven Beta-1 pattern

Built directly on the Beta-1 `download-service` approach (it worked):

- **Paths:** `MODELS_DIR = ${documentDirectory}/models` (trailing slash + `file://`
  stripped). llama.rn requires a **plain filesystem path** (no `file://`).
- **Download:** `createDownloadTask({ id, url, destination, isAllowedOverRoaming: true,
  isAllowedOverMetered: true, metadata })`; register `.begin().progress().done().error()`
  **before** `.start()`. (Handler-before-start ordering is mandatory.)
- **Progress + speed:** EMA-smoothed MB/s (0.7 prev + 0.3 instant), throttled to ≥0.5 s.
- **Resume across app restarts:** on launch, `getExistingDownloadTasks()` reattaches
  handlers; tasks already `DONE` in the background mark the model installed.
- **Verify:** a model is "installed" iff its file exists and `size >= 0.99 × sizeBytes`.
- **Delete:** `deleteAsync(idempotent)`; if the deleted model is active, stop generation
  and release the context first.
- **Pre-download space check:** compare `sizeBytes` against `getFreeDiskStorageAsync()`.
- **Controls:** cancel (`task.stop`), pause, resume per model id.

mmproj/vision download helpers from Beta 1 are intentionally **omitted** (text-only MVP).

## 8. Inference (`LlamaService`) — proven Beta-1 pattern

Singleton module owning one `LlamaContext`:

- **Concurrent-init guard:** an `_initPromise` ensures overlapping `initLlm` calls
  await the same init instead of a second caller assuming success (a real Beta-1 crash).
- **`initLlama` params (Gemma 4, proven):**
  `{ model: <plainPath>, n_ctx: 2048, n_batch: 32, n_threads: 4, n_gpu_layers: 0,
     use_mlock: false, use_mmap: true }`.
- **Model switch:** `releaseLlm()` (stop generation, await in-flight completion,
  `context.release()`) **before** loading a new model. No-op if the requested model is
  already loaded.
- **Error mapping:** `INSUFFICIENT_RAM` / `MODEL_NOT_FOUND` / `MODEL_LOAD_FAILED` from
  the native error string, surfaced to the UI.

### Prompt assembly (`prompt.ts`)

- **System prompt = base + profile.** Base: *"You are Aether, a private on-device AI
  assistant with no internet access. Be helpful, honest, and concise."* Then the profile:
  *"The user's name is {name}. They work as {occupation} and are working on {project}.
  They want help with {goals}. Always reply in {language}."*
- **Gemma manual prompt** (no jinja): system content is prepended to the first user turn:
  ```
  <start_of_turn>user
  {system}\n\n{firstUserMessage}<end_of_turn>
  <start_of_turn>model
  ```
  subsequent turns follow the same `<start_of_turn>user … model …` pattern.
- **Stop tokens:** `['<end_of_turn>', '<start_of_turn>']`.
- **Generation params (proven):** `n_predict: 1024, temperature: 0.7, top_p: 0.9,
  top_k: 40, penalty_repeat: 1.1`, streamed token-by-token via the completion callback.
- **Context trimming:** before each call, drop oldest message pairs (always keep the
  system prompt) to stay within `n_ctx: 2048`.

## 9. Load-a-model-on-every-chat-open flow

Per the requirement *"each time the user opens a chat a model has to load in"*:

1. `chat/[id].tsx` mounts → reads the conversation's `modelId` (falls back to
   `settings.activeModelId`).
2. If that model isn't installed → route to Settings / model selector.
3. `useInference` calls `LlamaService.initLlm(modelPath)`:
   - already loaded → resolves instantly (no overlay flash).
   - not loaded / different model → release old, init new.
4. While `isLoading()` is true, render `<ModelLoadingOverlay>` (pulsing logo +
   eased fake progress `~sizeGb × 2600 ms` + cycling status text — Beta-1 UX). Input
   is disabled until load completes.
5. On failure, show the mapped error (e.g. `INSUFFICIENT_RAM` → "Not enough memory —
   try Gemma 4 E2B").

## 10. Settings & storage management ("Spotify for models")

Route `app/(main)/settings.tsx`, reachable from the sidebar. Two sections:

**Storage (real device data via `expo-file-system`):**
- `getTotalDiskCapacityAsync()` and `getFreeDiskStorageAsync()` → a usage bar
  ("X GB used / Y GB total", percent fill).
- "Aether is using **N GB**" = sum of installed model `sizeBytes`.
- "**M GB** free" from the live free-space query.
- Refreshes on focus.

**Models:**
- Each registry model as a row: name, size, state (installed / downloading w/ progress /
  not downloaded), and an action (Download · Cancel · Delete).
- Delete → confirm dialog → if active, stop generation + release context + clear
  `activeModelId`, then delete file and update the store.
- Set-active control to choose which model new chats use.

## 11. Native / build configuration (CNG)

- **Android only**, `minSdkVersion 29`, `compileSdk`/`targetSdk` per SDK 52 defaults
  (via `expo-build-properties`).
- **arm64-v8a only** — `plugins/withArm64Only.js` sets
  `reactNativeArchitectures=arm64-v8a` in `gradle.properties` during prebuild (smaller
  APK, our only target ABI).
- **AsyncStorage size** — set `AsyncStorage_db_size_in_MB` (e.g. 64) via build properties
  so long histories don't hit the 6 MB SQLite default.
- **Dev client required** — `llama.rn` is native; the app never runs in Expo Go.
  Build via `expo prebuild` + Gradle (or EAS). Permissions: `INTERNET` (downloads only),
  `FOREGROUND_SERVICE` (background-downloader).

## 12. Error handling

| Area | Strategy |
|---|---|
| Download | No-space precheck; `.error` callback → retry; pause/resume; reattach on relaunch |
| Inference init | Map native errors → `INSUFFICIENT_RAM` / `MODEL_NOT_FOUND` / `MODEL_LOAD_FAILED`; overlay shows actionable message |
| Generation | Abort/cancel treated as normal completion; other errors surfaced inline |
| Storage | try/catch on every read; safe defaults; never crash on corrupt JSON |
| Context overflow | Auto-trim oldest turns to fit `n_ctx` |

## 13. Testing

- **Jest unit tests for pure logic** (native modules mocked):
  - `prompt.ts` — system-prompt assembly from profile; Gemma prompt formatting; trimming.
  - `storage/*` — serialize/round-trip; corrupt-data safety; index/conversation CRUD.
  - `models/registry` — shape, URL/filename consistency.
  - `ModelManager` verify-size logic (with mocked `expo-file-system`).
- **Manual verification in a dev client** (real native modules / real device):
  download → resume → load-on-open → streaming chat → model switch → delete.

## 14. Risks & mitigations

1. **8 GB + E4B is tight.** Mitigation: E2B is the default; `INSUFFICIENT_RAM` mapped to
   a "switch to E2B" message; `use_mmap: true`, `n_batch: 32`, `n_ctx: 2048`.
2. **HF URL / quant drift.** Mitigation: exact sizes pinned in the registry; verify ≥99%
   of expected size after download; URLs verified public on 2026-06-16.
3. **`llama.rn` 0.11.x × New Architecture (RN 0.76).** Mitigation: confirm compatibility
   at install; the implementation plan includes an early "load any GGUF on device" smoke
   step before building UI on top.
4. **Background-downloader foreground-service constraints (API 29+).** Mitigation:
   declare `FOREGROUND_SERVICE`; reattach on launch.
```
