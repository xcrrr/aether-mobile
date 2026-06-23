# Aether

A sovereign, **local-first AI assistant for Android**. Every reply is generated 100% on-device — no backend, no servers, no API keys, no telemetry. Fully offline after a one-time model download.

---

## What it does

### 🔒 Private AI chat
Chat with a locally-running Gemma 4 model. Nothing leaves your phone — no accounts, no data collection, no network requests after setup. Replies stream token-by-token and render full Markdown with code blocks.

### ⚡ Two Gemma 4 modes
Switch between **Fast** and **Thinking** from the chat header:

| Mode | Model | Size | Notes |
|---|---|---|---|
| **Fast** | Gemma 4 E2B | 3.46 GB | Snappy replies, safe on most 8 GB phones |
| **Thinking** | Gemma 4 E4B | 5.41 GB | Deeper reasoning, more capable |

Both download from HuggingFace (no auth) and are stored locally in GGUF `Q4_K_M` format. Both are flagged `supportsVision` for image attachments.

### 🎙️ Voice input
Open the **＋ bar** next to the composer and tap **Voice** to dictate with Android's **built-in on-device speech recognition** — no extra model download, offline on Android 10+.

- **Tap** to start, **tap again** to stop and commit the transcription
- A **moving violet gradient** sweeps above the composer while it's listening, with a live transcription preview
- `RECORD_AUDIO` is requested at first use; the real recognizer error is surfaced if anything goes wrong

> The `@react-native-voice/voice` module is patched (`patches/`) to resolve through `TurboModuleRegistry` under the bridgeless New Architecture — the native module registers as `RCTVoice` and is otherwise `null` on `NativeModules`.

### 📎 Attachments — the ＋ bar
A Claude-style collapsible **＋ button** next to the composer opens a minimal action bar: **Attach** (Camera / Photo Library / Files / Paste-image), **Research** toggle, and **Voice**. One attachment per message; the camera captures a single photo.

| Type | Extensions | Handling |
|---|---|---|
| Images | jpg, jpeg, png, webp, gif | Fed to the model's multimodal path when a vision pack is loaded (see below); durable thumbnail |
| PDF | pdf | On-device text extraction (pako-inflated content streams) |
| Plain text | txt, md, csv, json, xml | Read directly |
| Word | docx | Text extracted via `mammoth` (pure JS) |

Extracted document text is injected into the prompt as a quoted context block. Large documents (> 6 000 chars) show a "response quality may vary" badge. Unreadable PDFs (scanned/image-only) fall back to a clear prompt asking you to paste the relevant text. Image data is **stripped from persisted conversations** (kept in-memory only for the active generation; the image file is copied to durable storage for redisplay) so large photos never exceed Android's per-row storage limit.

### 🖼️ Image analysis (vision)
True image understanding runs on-device via a **multimodal projector (mmproj) "vision pack"**, downloaded once per model (~0.9 GB):

- Attach a photo and send — if the pack isn't loaded yet you're prompted to **download it right there**, or manage packs in **Settings → Image understanding**
- The downloaded pack is **integrity-checked** (GGUF magic bytes + size) so a truncated download or a saved error page can't silently break vision — a corrupt pack is dropped and you're asked to re-download
- After loading, a **self-test** decodes a tiny bundled image to confirm the projector actually works on this device; the result drives a clear status (Working / Verifying / Unavailable)
- The image is delivered to the model with the correct `<__media__>` marker; `image_max_tokens` is bounded for 8 GB devices
- Failures are **surfaced, not swallowed** — the real reason shows under the composer (e.g. `Image reading failed: …`) instead of the model quietly hallucinating; if vision genuinely isn't available Aether **says so honestly**
- Tap any image in a message to open a **fullscreen viewer** with pinch-to-zoom, pan, double-tap zoom, and share

### 🌐 Web research
Toggle **Research** in the header to run a grounded, cited answer: DuckDuckGo search → fetch sources → synthesize with inline citations. Network/parse failures surface as a normal message, never a crash.

### 🧠 Second Brain
Aether distils conversations into durable, structured memory about you (name, work, projects, goals, preferences…), reusing the loaded model — never a second instance. Learned facts are injected into future system prompts so it remembers you across chats.

- **Reliable auto-learning** — an idle queue marks each conversation dirty after a reply and runs extraction only when the model is free (and on app background), so learning finishes in the gaps instead of being aborted by your next message. A manual **"Analyze current chat now"** button still forces it on demand.
- **Relationships** — extraction also captures links between facts (e.g. *business → located_in → city*), which become edges in the graph.
- **Quality upkeep** — repeated facts are reinforced (confidence rises), values are kept concise, and low-confidence facts that go long-unseen decay to *stale* and can be purged with one tap.
- **Curate it** — search, filter by category, **edit** a fact's value, **add** your own fact, and delete facts or clear everything. Fully local and toggleable.

#### 🌐 3D thought graph
The Second Brain screen renders your memory as an **Obsidian-style interactive 3D graph** — each thought is a node coloured by category, related thoughts are linked:

- **Rotate, pinch-zoom, pan, and drag nodes**; the cluster slowly auto-rotates when idle and pauses the moment you touch it
- **Always-on labels** on every node (readable on touch, no hover needed), a **category legend**, and **tap-to-highlight** that lights up a thought's connections and dims the rest
- Tap a node for a **read/edit popup**; a **fullscreen** toggle expands the graph; tapping a list row flies the camera to that node
- A **list view** toggle remains for a plain, accessible browse
- Rendered in a WebView from a **fully offline, self-contained asset** (three.js + 3d-force-graph + label sprites are inlined — no network, no CDN)

### 💬 Onboarding, history & storage
- Short 2-step onboarding (name + goals) feeds every system prompt
- Local conversation history with a sliding sidebar
- Background model downloads survive screen-off via a native foreground service
- Spotify-style storage screen with per-model disk usage; download / cancel / delete individually
- Pre-load RAM headroom check with a "Load Anyway" override

---

## Requirements

- **Android only**, API 29+ (Android 10+)
- **arm64-v8a** device (standard on modern phones)
- **≥ 8 GB RAM** recommended (more for Thinking mode)
- Cannot run in Expo Go — requires a native build

---

## Tech stack

| Layer | Library |
|---|---|
| Framework | Expo SDK 52 · React Native 0.76 · New Architecture |
| Language | TypeScript (strict) |
| Navigation | expo-router v4 + Drawer |
| Inference | `llama.rn` 0.12.0-rc.6 |
| Voice | `@react-native-voice/voice` (native Android SpeechRecognizer) |
| Files | `expo-image-picker` · `expo-document-picker` · `expo-file-system` |
| Doc parsing | `mammoth` (docx) · `pako` (PDF stream inflate) |
| Downloads | `@kesha-antonov/react-native-background-downloader` |
| State | Zustand |
| Animation/Gesture | `react-native-reanimated` · `react-native-gesture-handler` |
| Rendering | `react-native-marked` (Markdown) |
| 3D graph | `react-native-webview` hosting inlined `three` · `three-spritetext` · `3d-force-graph` (offline) |
| Storage | AsyncStorage |

---

## Build

```bash
npm install
npx expo prebuild -p android
npx expo run:android
```

Requires Android Studio + a JDK. Connect a device with USB debugging enabled. The first chat prompts you to download a model from Settings.

### Debug APK

```bash
cd android
./gradlew assembleDebug
```

### Release APK (arm64 only)

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

> **Jetifier:** `@react-native-voice/voice` pulls in legacy `com.android.support` artifacts that clash with AndroidX. `plugins/withAetherAndroid.js` sets `android.enableJetifier=true` so they're rewritten automatically — this survives `expo prebuild`, so no manual Gradle edits are needed.

---

## Permissions

| Permission | Why | Requested |
|---|---|---|
| `RECORD_AUDIO` | Voice input | At first mic use |
| `CAMERA` | Photo capture for image attachments | At first camera use |
| `INTERNET` | Model download + web research | — |
| `FOREGROUND_SERVICE` | Keep downloads alive with screen off | — |

All runtime permissions are requested at the point of first use, never at launch.

---

## Project layout

```
app/                     Routes: onboarding, (main) drawer, chat, settings
src/llm/                 LlamaService (context + multimodal), prompt assembly
src/voice/               VoiceService singleton + RECORD_AUDIO permission helper
src/files/               FileProcessor, PDF/base64 extractors, pickers
src/webresearch/         DuckDuckGo search, content fetch, citation formatting
src/secondbrain/         Memory extraction, store (facts + edges + decay), injection, idle queue
src/models/              Model registry + ModelManager (download/verify, mmproj integrity)
src/state/               Zustand stores (chat, model, profile, toast)
src/hooks/               useInference, useVoice, useAttachment
src/components/          UI: chat · sidebar · settings · secondbrain (3D graph) · design system
src/theme/               Design tokens (colors, spacing, fonts, radius)
plugins/                 withAetherAndroid (arm64, AsyncStorage, Jetifier, perms)
assets/graph/            Offline self-contained 3D-graph WebView page (graph.html)
assets/                  Icons, logos, splash, vision self-test image
```

---

## Testing

```bash
npm test          # Jest unit suite
npm run typecheck # tsc --noEmit (strict)
```

Covers prompt assembly (incl. attachment injection), model registry, mmproj integrity + vision self-test, storage, web research, and Second Brain logic (extraction, edges, reinforcement/decay, the idle queue, and graph-data mapping).

---

## License

Private project. © Adam Parszewski.
