<div align="center">

# Aether

**A private AI assistant for Android.**

Chat, memory and web research that run on your phone — not on someone else's server.

[![Latest release](https://img.shields.io/github/v/release/xcrrr/aether-mobile?label=release&color=6b5bd6)](https://github.com/xcrrr/aether-mobile/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Android%2010%2B-3ddc84)](#requirements)
[![Architecture](https://img.shields.io/badge/arch-arm64--v8a-lightgrey)](#requirements)
[![Inference](https://img.shields.io/badge/inference-Google%20LiteRT--LM-4285f4)](#mobile-stack)

[**Download the APK**](https://github.com/xcrrr/aether-mobile/releases/latest) · [Release notes](releases/RELEASE-NOTES.md) · [Status and limitations](#status-and-limitations)

</div>

---

Most AI assistants are rented from a server. Aether runs a Google LiteRT language model directly on
the phone, keeps conversations and Core memory on the device, and only goes online when you
explicitly turn on Research for a message.

- **Local by default** — everyday chat runs on the device once a model is downloaded, and works offline.
- **Private memory** — Core stores personal context locally, where you can review, edit, delete or disable it.
- **No account** — the app needs no backend account for normal use.
- **Transparent online mode** — Research is opt-in per message and clearly separate from offline chat.

<!-- screenshot: on-device chat, Fast mode -->
<!-- screenshot: Core knowledge graph view -->
<!-- screenshot: Research live source-reading card with inline citations -->

## Install

1. Download `Aether-2.2.1.apk` from the [latest release](https://github.com/xcrrr/aether-mobile/releases/latest).
2. Allow installation from unknown sources when Android asks.
3. Open the app and download a model when prompted. This is a one-time download of 2.6 GB or 3.7 GB.

Verify the download if you want to:

```bash
sha256sum Aether-2.2.1.apk
# 17f9f0bfd6e796067033fb8483c536220c87b3032429f6222715651a91dc7580
```

The APK is signed with APK Signature Scheme v2; the signer is `CN=Aether, O=Aether, C=PL`.

## Features

### On-device chat

Talk to Aether with a local LiteRT model. Replies stream in the app, and normal chat works offline
once a model is installed.

### Fast and Thinking modes

**Fast** (Gemma 4 E2B) for everyday questions, **Thinking** (Gemma 4 E4B) for answers that need more
reasoning. Both see images.

### Core memory

Core is a visual knowledge graph of facts Aether has learned about you, built entirely from what you
actually said. A fact is only saved when it is grounded in a verbatim quote from your side of the
conversation — the extractor mechanically rejects anything it cannot point back to your own words.

Every fact and its connections are visible in Core's graph view. Nothing is sent to a server;
memories can be reviewed, edited or deleted on the device at any time.

### Research

Research is opt-in, per message. When you turn it on, Aether:

- searches the public web and reads up to three real sources,
- shows a live card naming which sources it is reading, including which succeeded or failed,
- writes its answer with inline `[1]`, `[2]`, `[3]` markers that map to the numbered sources below it.

Ordinary chat never does this on its own.

### Images and files

Attach images and documents so Aether can use them as context: images, PDFs with readable text,
Word `.docx`, and plain text, Markdown, CSV, JSON and XML.

### Voice input

Dictate a message using Android speech recognition. Recognition is handled by whatever
speech-recognition service the device provides (Google, Samsung or another OS-level recognizer) —
Aether does not send the audio anywhere itself, and only the recognized text reaches the app.

### Not in this build

Task (a local, multi-step agent) and Library (its saved outputs) exist in the source tree —
`app/src/agent/`, 20 files with their own test suite — but are not reachable anywhere in the app. A
single flag, `TASK_UI_ENABLED` in `app/src/release/features.ts`, controls their visibility and is
currently `false`.

This is a scope decision for the first beta, not an unfinished stub. Task is the surface with the
least real-device verification behind it, and this release focuses on the two features that define
Aether — Core and Research. The code stays in place and keeps compiling under strict TypeScript and
the full test suite; the flag only hides it from the UI.

## Privacy

Aether makes an outbound network call in exactly two situations:

1. **Model download** — fetching a `.litertlm` file from Hugging Face
   (`huggingface.co/litert-community/...`), started only when you tap to download a model.
2. **Research** — only when you turn it on for a message: a DuckDuckGo HTML search
   (`html.duckduckgo.com/html/`), followed by fetching the text of whichever result pages it reads.

There is no account system, no analytics SDK and no crash-reporting SDK anywhere in the app source.
Voice input is transcribed by the device's own Android speech recognizer; Aether does not send audio
anywhere itself, and whether that involves a network call depends on the phone and OS.

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW` were removed in this release —
none were needed, and none were declared by the app itself.

## Requirements

- **Android 10 or newer** (`minSdkVersion` 29).
- **arm64-v8a only.** The APK packages no other architecture; it will not install on a 32-bit or
  x86 device.
- Two models are offered, both recommended for devices with at least **8 GB of total RAM**:
  - **Gemma 4 E2B** (Fast) — 2.6 GB download.
  - **Gemma 4 E4B** (Thinking) — 3.7 GB download.
- At load time the app checks currently *available* RAM and refuses to load a model unless free
  memory is above 1.2× the model's file size (roughly 3.2 GB free for E2B, 4.4 GB for E4B), with an
  explicit "Load Anyway" override.
- A one-time internet connection to download a model. Chat works offline after that.

## Status and limitations

Aether is **pre-release beta software**. Concretely:

- **The in-app legal documents are drafts.** Closed Beta Terms, Privacy Notice, Research Disclosure
  and AI Safety Notice are each marked "requires review by the publisher / legal representative
  before release". Publisher identity and support/privacy contacts are not yet set. See
  [`docs/aether-legal-review-required.md`](docs/aether-legal-review-required.md).
- **This build has not been verified on a physical device.** It compiles, passes the full automated
  suite and is correctly signed, but the 2.2.1 fixes have not been confirmed by hand on hardware.
  The script for that is [`docs/aether-device-beta-checklist.md`](docs/aether-device-beta-checklist.md).
- **Voice input is unverified on real hardware.**
- **Core's extraction quality has no measured baseline.** There is no fixture set of real
  conversations with expected extractions, so a change to the extractor can be shown to be different
  but not better.
- **The sampling defaults are a considered choice, not a measurement.** They have not been A/B
  tested on hardware.
- As of the last dependency audit (2026-07-14), `npm ci` in `app/` reported 24 vulnerabilities (17
  moderate, 6 high, 1 critical), with no upgrades applied. Not re-audited since.
- `expo-print` is still a dependency for the now-unreachable PDF export.

## Mobile stack

| Layer | Technology |
| --- | --- |
| App framework | Expo SDK 52, React Native 0.76 (New Architecture, bridgeless) |
| Language | TypeScript (strict) |
| Navigation | Expo Router, React Navigation Drawer |
| Local inference | Google LiteRT-LM, `.litertlm` model files |
| Native bridge | Custom Android LiteRT TurboModule |
| State | Zustand, AsyncStorage |
| Files | Expo FileSystem, document and image pickers |
| Web research | DuckDuckGo HTML search plus sanitized page fetching |
| Core graph | three.js / three-forcegraph, bundled as a local static HTML asset |
| Tests | Jest, React Native Testing Library |

## Build from source

Requires Node.js. A native Android build additionally needs a JDK 17 and the Android SDK/NDK
toolchain React Native 0.76 expects (SDK 35, build-tools 35.0.0, NDK 26.1.10909125).

```bash
cd app
npm ci
npm run typecheck
npm test
```

Build a release APK:

```bash
cd app
export JAVA_HOME=<path to your JDK 17>   # e.g. Android Studio's bundled JBR
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Without `android/keystore.properties` the release build falls back to the debug keystore — usable
for local testing, never for distribution. Gradle prints a warning when this happens. See
[`app/android/keystore.properties.example`](app/android/keystore.properties.example).

Release checks:

```bash
npm run preflight:beta     # development check; distribution blockers are listed, exit 0
npm run preflight:public   # same checks, but distribution blockers fail the run
```

On Windows, prefer a short build path such as `C:\a2`. Long Desktop paths can trip CMake/Ninja in
React Native native modules.

### Website

```bash
cd website
npm ci
npm run lint
npm test
npm run build
```

## Repository layout

```text
app/              Expo + React Native Android app
website/          Next.js marketing and product site
releases/         Release notes and installable APK artifacts
docs/             Product, architecture, verification and release docs
design-artifacts/ Visual QA, screenshots and design explorations
codex-notes/      Codex build notes, audits and context
claude-notes/     Claude handoff notes and development context
```

## Product principles

- **The phone is the home base.** Local inference, local storage, local control.
- **You stay in charge.** Memory and web access are visible choices, not hidden behaviour.
- **No fake magic.** If Aether uses a source, a file, a model or Core memory, the product should
  make that understandable.
- **Beautiful is part of useful.** The app should feel calm and crafted, not like a debug shell
  with buttons.

## Development notes

- Do not restore the old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack architecture.
  LiteRT `.litertlm` is the active model path.
- Patch-package patches live in `app/patches/` and must apply during `npm ci`. Never regenerate them
  after a Gradle build — it captures the entire build output.
- `app/assets/graph/graph.html` is a build artifact. Run `node assets/graph/build.js` after editing
  the scene.
- Generated folders (`node_modules`, `.next`, Android `build`, `.gradle`, `.cxx`) are not source.
- Keep handoff notes in `codex-notes/` and `claude-notes/` so future sessions have real context.

## Licence

No licence has been chosen yet, so default copyright applies: all rights reserved. If you want to
reuse any of this, open an issue and ask.
