# Aether — Beta 2

A sovereign, **local-first AI chat app for Android**. Every reply is generated
100% on-device via `llama.rn` (llama.cpp). No backend, no servers, no API keys,
no telemetry — fully offline after the model downloads once.

## Features

- **On-device inference** — chat works with no internet after the model is downloaded.
- **Two Gemma 4 models** (GGUF Q4_K_M, from HuggingFace, no auth required):
  - **Gemma 4 E2B** — 3.46 GB · *Recommended* (safe on 8 GB phones)
  - **Gemma 4 E4B** — 5.41 GB · *Most capable* (needs RAM headroom)
- **Memory** — a 5-step onboarding profile (name, occupation, project, goals,
  language) is injected into every conversation's system prompt.
- **Conversations** — full history, stored locally, sliding sidebar with a model selector.
- **Settings & storage** — Spotify-style view of real device storage + per-model
  usage, with download / cancel / delete.
- **Markdown + code blocks** in assistant replies; token streaming; the model
  (re)loads each time you open a chat (with a loading overlay).

## Requirements

- **Android only**, API 29+ (Android 10+), **arm64-v8a**, **≥ 8 GB RAM**.
- A development build (dev client) — this app uses native modules and **cannot run
  in Expo Go**.

## Tech stack

Expo SDK 52 (RN 0.76, New Architecture) · TypeScript (strict) · expo-router + Drawer ·
`llama.rn` 0.11.x · `@kesha-antonov/react-native-background-downloader` 4.5.x ·
AsyncStorage · Zustand · `react-native-marked`.

## Build & run on a device

```bash
npm install                 # uses .npmrc legacy-peer-deps
npx expo prebuild -p android   # generate native project (CNG)
npx expo run:android        # build + install on a connected device
```

Requires Android Studio / the Android SDK + JDK installed, with a device connected
(USB debugging on) or an arm64 emulator. The first chat triggers a model download
in Settings.

## Scripts

```bash
npm test          # jest unit tests (pure logic)
npm run typecheck # tsc --noEmit
npm run android   # expo run:android
```

## Project layout

```
app/                     expo-router routes (onboarding, (main) drawer, chat, settings)
src/llm/                 LlamaService (single context lifecycle) + prompt assembly
src/models/              hardcoded registry + ModelManager (download/verify/delete/space)
src/storage/             AsyncStorage CRUD (profile, settings, conversations)
src/state/               Zustand stores
src/components/          chat · sidebar · settings · common UI
plugins/                 withAetherAndroid (arm64-only + AsyncStorage size)
docs/superpowers/        design spec + implementation plan
```

## License

Private project. © Adam Parszewski.
