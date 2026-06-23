# Aether Mobile — CLAUDE.md

## Project identity
- **What:** Sovereign, local-first AI assistant for Android. All inference is on-device; no backend.
- **Repo:** `github.com/xcrrr/aether-mobile` (gh user: xcrrr)
- **Active branch:** `main`
- **APK:** built locally with Gradle (arm64-v8a); released as GitHub Releases (APK > 100MB → never committed)
- **Version:** 2.0.0

## Stack (never change without asking)
| Layer | Library | Version |
|---|---|---|
| Framework | Expo SDK 52 + React Native 0.76 New Architecture (bridgeless) | — |
| Language | TypeScript strict | — |
| Navigation | expo-router v4 + Drawer | — |
| Inference | llama.rn | 0.12.0-rc.6 |
| Voice | @react-native-voice/voice | 3.2.4 (patched) |
| Downloads | @kesha-antonov/react-native-background-downloader | 4.5.5 (patched) |
| State | Zustand + AsyncStorage persist | — |
| Markdown | react-native-marked | — |

## Key architectural rules

### Single native LLM context — no concurrency
`LlamaService` owns ONE `llama.rn` context. TWO concurrent `context.completion()` = hard native crash. Every path must go through:
- `generate()` → calls `drainActive()` first, then locks `activeCompletion`
- `extract()` → returns null if `activeCompletion` is set (preempt:true drains instead)
- Never call `drainActive()` from inside a completion callback → deadlock

### New Architecture bridgeless — NativeModules is null
Native modules register as TurboModules under bridgeless. `NativeModules.Foo` is always null.
- `@react-native-voice/voice` → patched to use `TurboModuleRegistry.get('RCTVoice')` (patches/)
- `@kesha-antonov/react-native-background-downloader` → patched to fall back to TurboModule (patches/)
- When adding any new native lib: check if it uses `NativeModules.X` — patch if so.

### AsyncStorage 2 MB row limit
Android SQLite `CursorWindow` = 2 MB per row. Never store image base64 in conversation rows.
- `forStorage()` in `storage/conversations.ts` strips `imageBase64` before write
- Images are copied to `${documentDirectory}chat-media/{id}.jpg` for durable display

### Context window / N_CTX
`LlamaService.N_CTX = 4096`. Silent `extract()→null` = almost always context overflow.
- Research sources: capped at 1100 chars each, max 3 sources
- Extraction transcript: trimmed to 4000 chars total
- N_CTX maths: keep prompts + completion well under 4096 tokens

### Vision (multimodal)
- Requires mmproj pack (~940 MB) downloaded separately per model
- `initMultimodal({path, use_gpu:false, image_max_tokens:512})` — check return value + `isMultimodalEnabled()`
- Prompt MUST include `<__media__>` marker when mediaPaths.length > 0 (`buildUserContent`)
- mediaPaths computed BEFORE `drainActive()` — no await between drain and lock (race = crash)
- Honesty fallback: if vision not loaded, tell user honestly instead of hallucinating

## Build commands
```bash
# Set Java (required)
export JAVA_HOME=/home/xcrr1/android-studio-panda3-linux/android-studio/jbr

# Real device APK (arm64)
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

# After patching node_modules JS — force fresh Hermes bundle:
rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets \
       android/app/build/intermediates/assets/release \
       android/app/build/intermediates/merged_assets/release
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Tests
```bash
npm test          # Jest (currently ~137 tests)
npm run typecheck # tsc --noEmit strict
```
All new code needs tests. TDD preferred: test→RED→impl→GREEN.

## File layout
```
app/                        Routes: onboarding, (main) drawer, chat, settings
src/llm/                    LlamaService, prompt.ts
src/voice/                  VoiceService
src/files/                  FileProcessor, PDF/docx extractors
src/webresearch/            DuckDuckGo→fetch→cite pipeline (safety.ts is the security chokepoint)
src/secondbrain/            Memory extraction + store
src/models/                 Model registry + ModelManager (download/verify/delete/mmproj)
src/state/                  Zustand stores (useChatStore, useModelStore, useProfileStore)
src/hooks/                  useInference, useVoice, useAttachment
src/components/             UI components
src/theme/                  Design tokens
plugins/                    withAetherAndroid (Expo config plugin)
patches/                    patch-package patches for voice + downloader
```

## Known issues / next work
- Voice still unverified on all real devices — surface real error from `Voice.start()` throw
- Vision (mmproj) device-unverified — `initMultimodal` may need tweaks for gemma4
- Second Brain auto-extraction often preempted; manual "Analyze now" button is the reliable path
- Reinit self-heal after hard crash exists (`reinit()`) — monitor for stability

## Coding rules (strict)
1. No comments unless WHY is non-obvious
2. No error handling for scenarios that can't happen
3. No feature flags, no backwards-compat shims
4. Don't add features beyond what's asked
5. Security: web text always sanitized via `safety.ts` before hitting any prompt (prompt-injection guard)
6. Patches go in `patches/` via patch-package; add to `postinstall` in package.json

## GitHub
- Remote: `github.com/xcrrr/aether-mobile`
- Releases: APK uploaded via `gh release create vX.Y.Z` (never git-committed)
- Commit style: short imperative, no AI co-author footer needed unless explicitly asked
