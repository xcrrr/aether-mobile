# Aether

Private AI for Android. Fast, local-first, and built for people who want a capable assistant without handing every conversation to the cloud.

Aether runs a Google LiteRT language model directly on the phone, keeps conversations and Core memory on-device, and only goes online when the user explicitly turns on Research for a message.

## Why Aether

Most AI assistants are rented from a server. Aether is different:

- **Local by default**: everyday chat runs on the Android device after the model is downloaded, and works offline once installed.
- **Private memory**: Core stores useful personal context locally, where the user can review, edit, delete, or disable it.
- **No account required**: the app does not need a backend account for normal use.
- **Transparent online mode**: Research is opt-in per message and clearly separate from offline chat.

## Features

### On-device chat

Talk to Aether with a local LiteRT model. Replies stream in the app, and normal chat works offline once a model is installed.

### Fast and Thinking modes

Use **Fast** (Gemma 4 E2B) for everyday questions and **Thinking** (Gemma 4 E4B) for deeper answers that need more reasoning. Both see images.

### Core memory

Core is a visual knowledge graph of facts Aether has learned about the user, built entirely from what the user actually said. A fact is only saved when it is grounded in a verbatim quote from the user's side of the conversation — the extractor mechanically rejects anything it can't point back to the user's own words.

Every fact and its connections are visible in Core's graph view. Nothing is sent to a server; memories can be reviewed, edited, or deleted on the device at any time.

### Images and files

Attach images and supported documents so Aether can use them as context.

Supported inputs include:

- Images
- PDFs with readable text
- Word `.docx` files
- Plain text, Markdown, CSV, JSON, and XML files

### Research

Research is opt-in, per message. When a user turns it on, Aether:

- searches the public web and reads up to three real sources,
- shows a live card naming which sources it is reading while it works, including which ones succeeded or failed, and
- writes its answer with inline `[1]`, `[2]`, `[3]` citation markers that map to the numbered sources shown underneath.

Ordinary chat never does this on its own.

### Voice input

Use Android speech recognition to dictate a message into the chat composer. Recognition is handled by whatever speech-recognition service the device provides (Google, Samsung, or another OS-level recognizer) — Aether does not send the audio anywhere itself, and only the recognized text reaches the app.

### Not in this build

Task (a local, multi-step agent) and Library (its saved outputs) exist in the source tree — `src/agent/`, 20 files, with its own test suite — but are not reachable anywhere in the app. A single flag, `TASK_UI_ENABLED` in `app/src/release/features.ts`, controls their visibility and is currently `false`.

This is a scope decision for the first beta, not an unfinished stub: Task was judged the least convincing surface in real use, and shipping it in a first public beta would mean the weakest feature is the one new users judge the app by. The code stays in place and keeps compiling under strict TypeScript and the full test suite; the flag only hides it from the UI.

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
| App framework | Expo SDK 52, React Native 0.76 |
| Language | TypeScript (strict) |
| Navigation | Expo Router, React Navigation Drawer |
| Local inference | Google LiteRT-LM, `.litertlm` model files |
| Native bridge | Custom Android LiteRT TurboModule |
| State | Zustand, AsyncStorage |
| Files | Expo FileSystem, document/image pickers |
| Web research | DuckDuckGo HTML search plus sanitized page fetching |
| Core graph | three.js / three-forcegraph, bundled as a local static HTML asset |
| Tests | Jest, React Native Testing Library |

## Requirements

- Android only. arm64-v8a is the only architecture the build produces (`reactNativeArchitectures=arm64-v8a` in `android/gradle.properties`) — it will not install on a 32-bit or x86 device.
- `minSdkVersion` 29 (Android 10 and newer).
- Two models are offered, both listed by the app as recommended for devices with at least 8 GB of total RAM:
  - **Gemma 4 E2B** (Fast) — 2.6 GB download.
  - **Gemma 4 E4B** (Thinking) — 3.7 GB download.
- Separately, at load time the app checks currently *available* RAM and refuses to load a model unless free memory is above 1.2x that model's file size (roughly 3.2 GB free for E2B, 4.4 GB free for E4B), with an explicit "Load Anyway" override if a user wants to try anyway.
- A one-time internet connection to download a model from Hugging Face. Chat works offline after that.

## Current Build

- App version: `2.1.0`
- Android package: `com.aether.app`
- Active inference engine: LiteRT-LM, `.litertlm`
- Installable artifact: [`releases/Aether-2.1.0-latest.apk`](releases/Aether-2.1.0-latest.apk) — built from an earlier commit than `HEAD`; see [`releases/RELEASE-NOTES.md`](releases/RELEASE-NOTES.md) for what has changed since.
- App verification (this checkout, re-run 2026-07-28): `tsc --noEmit` clean; Jest `47` suites / `606` tests pass.
- Website verification: last recorded 2026-07-14 in [`docs/current-verification-baseline.md`](docs/current-verification-baseline.md) (`8` suites / `21` tests, lint and production build passing) — not re-run for this update.

## Build from source

Requires Node.js. A native Android build additionally needs a JDK and the Android SDK/NDK toolchain that React Native 0.76 expects.

```bash
cd app
npm ci
npm run typecheck
npm test
```

Build a release APK (arm64 only):

```bash
cd app
export JAVA_HOME=<path to your JDK>   # e.g. Android Studio's bundled JBR
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Without `android/keystore.properties` present, the release build falls back to signing with the debug keystore — usable for local testing, not for distribution. See `android/keystore.properties.example`.

On Windows, prefer a short build path such as `C:\a2` or `C:\aether-build` for native release builds. Long Desktop paths can trip CMake/Ninja in React Native native modules.

A combined preflight check (identity/version consistency, required legal docs, tests, typecheck) is available:

```bash
npm run preflight:beta
```

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

## Privacy

Aether makes an outbound network call in exactly two situations:

1. **Model download** — fetching a `.litertlm` file from Hugging Face (`huggingface.co/litert-community/...`), started only when a user taps to download a model.
2. **Research** — only when a user turns it on for a message: a DuckDuckGo HTML search (`html.duckduckgo.com/html/`), followed by fetching the text of whichever result pages it decides to read.

There is no account system, no analytics SDK, and no crash-reporting SDK anywhere in the app source. Voice input is transcribed by the device's own Android speech recognizer; Aether does not send audio anywhere itself, and this may or may not involve a network call depending on the phone and OS.

## Status and limitations

Aether is **pre-release beta software**. Concretely:

- The in-app legal documents (Closed Beta Terms, Privacy Notice, Research Disclosure, AI Safety Notice) are drafts, each explicitly marked "requires review by the publisher / legal representative before release." See [`docs/aether-legal-review-required.md`](docs/aether-legal-review-required.md) for the open legal decisions.
- The current build is **debug-signed**. The Gradle config supports a release-signed build via `android/keystore.properties`, but that file is not present in this checkout, so any release APK built from this tree today is signed with the debug keystore and must not be distributed as-is.
- Task and Library are implemented but hidden from the app for this beta (see "Not in this build" above).
- Voice input has not been verified on real hardware yet.
- Core's automatic fact extraction can be preempted if the user sends another message quickly after a reply; the manual "Analyze now" action is the reliable path today.
- Extraction quality has no measured baseline — there is no fixture set of real conversations with expected extractions, so a change to Core's extraction prompt or policy can't yet be shown to be an improvement rather than just a change.
- A round of fixes to Research, Core's graph rendering, recall matching, and inference sampling, plus two device-reported bugs (a gray screen on system back-out of Settings/Core, and chat not scrolling to the newest message after sending while scrolled up), are typecheck-clean and covered by the automated test suite, but none of them has been confirmed yet on an Android device — there is no Android toolchain on the machine these changes were made on.
- As of the last recorded dependency audit (2026-07-14), `npm ci` in `app/` reported 24 vulnerabilities (17 moderate, 6 high, 1 critical) with no upgrades applied yet; this has not been re-audited since.

<!-- screenshot: on-device chat, Fast mode -->
<!-- screenshot: Core knowledge graph view -->
<!-- screenshot: Research live source-reading card with inline citations -->
