# Aether

Private AI for Android. Fast, local-first, and built for people who want a capable assistant without handing every conversation to the cloud.

Aether runs modern LiteRT language models directly on the phone, keeps conversations and memory on-device, and only goes online when the user explicitly turns on Research or asks an online Task to use web sources.

## Why Aether

Most AI assistants are rented from a server. Aether is different:

- **Local by default**: everyday chat runs on the Android device after the model is downloaded.
- **Private memory**: Core stores useful personal context locally, where the user can review, edit, delete, or disable it.
- **No account required**: the app does not need a backend account for normal use.
- **Built for real work**: chat, writing, planning, files, images, web research, and multi-step tasks live in one mobile experience.
- **Transparent online mode**: Research is opt-in and clearly separate from offline chat.

## Features

### On-device chat

Talk to Aether with a local LiteRT model. Replies stream in the app, and normal chat can work offline once a model is installed.

### Fast and Thinking modes

Use **Fast** for everyday questions and **Thinking** for deeper answers that need more reasoning.

### Core memory

Core helps Aether remember useful facts about the user without sending them to a server. Memories are local, visible, editable, and removable.

### Images and files

Attach images and supported documents so Aether can use them as context.

Supported inputs include:

- Images
- PDFs with readable text
- Word `.docx` files
- Plain text, Markdown, CSV, JSON, and XML files

### Research

When the user enables Research, Aether can search the public web, read selected pages, and answer with source citations. Ordinary chat does not use this flow.

### Task mode

Task mode is a bounded local agent flow for larger requests such as planning, comparison, research, refinement, and synthesis. Aether keeps a simple receipt of what happened so the result is easier to trust.

### Voice input

Use Android speech recognition to dictate a message into the chat composer.

## Product Principles

- **The phone is the home base.** Local inference, local storage, local control.
- **The user stays in charge.** Memory and web access are visible choices, not hidden behavior.
- **No fake magic.** If Aether uses a source, a file, a model, or Core memory, the product should make that understandable.
- **Beautiful is part of useful.** The app should feel calm, crafted, and trustworthy, not like a debug shell with buttons.

## Repository Layout

```text
app/              Expo + React Native Android app
website/          Next.js marketing and product site
releases/         Installable APK artifacts
docs/             Product, architecture, verification, and release docs
design-artifacts/ Visual QA, screenshots, previews, and design explorations
codex-notes/      Codex build notes, audits, cleanup logs, and context
claude-notes/     Claude handoff notes and product/development context
```

## Mobile Stack

| Layer | Technology |
| --- | --- |
| App framework | Expo SDK 52, React Native 0.76, New Architecture |
| Language | TypeScript |
| Navigation | Expo Router, React Navigation Drawer |
| Local inference | Google LiteRT `.litertlm` models |
| Native bridge | Custom Android LiteRT TurboModule |
| State | Zustand, AsyncStorage |
| Files | Expo FileSystem, document/image pickers |
| Web research | DuckDuckGo HTML search plus sanitized page fetching |
| Tests | Jest, React Native Testing Library |

## Current Build

- App version: `2.1.0`
- Android package: `com.aether.app`
- Active inference engine: LiteRT `.litertlm`
- Latest APK: `releases/Aether-2.1.0-latest.apk`
- Latest verified test run: `38` suites, `500` tests passing

## Getting Started

### Mobile app

```bash
cd app
npm ci
npm run typecheck
npm test
```

Build a release APK:

```bash
cd app/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

On Windows, prefer a short build path such as `C:\a2` or `C:\aether-build` for native release builds. Long Desktop paths can trip CMake/Ninja in React Native native modules.

### Website

```bash
cd website
npm ci
npm run lint
npm test
npm run build
```

Run locally:

```bash
cd website
npm run dev
```

## Development Notes

- Do not bring back the old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack architecture.
- LiteRT `.litertlm` is the active model path.
- Patch-package patches live in `app/patches/` and must apply during `npm ci`.
- Generated folders such as `node_modules`, `.next`, Android `build`, `.gradle`, and `.cxx` are not source.
- Keep handoff notes in `codex-notes/` and `claude-notes/` so future sessions have real context.

## Privacy Model

Aether is local-first:

- Conversations are stored on the device.
- Core memory is stored on the device.
- Model inference runs on the device.
- No account is required for normal use.
- Online access is reserved for explicit Research and online Task actions.

## Status

Aether is in active closed-beta development. The current release artifact is available in `releases/`, and the source tree includes the mobile app, website, release notes, design QA, and implementation handoff context needed to continue the project cleanly.
