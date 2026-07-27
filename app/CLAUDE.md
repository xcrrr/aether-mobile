# Aether Mobile — CLAUDE.md

## Project identity
- **What:** Sovereign, local-first AI assistant for Android. All inference is on-device; no backend.
- **Repo:** `github.com/xcrrr/aether-mobile` (gh user: xcrrr)
- **Active branch:** `main`
- **APK:** built locally with Gradle (arm64-v8a); released as GitHub Releases (APK > 100MB → never committed)
- **Version:** 2.1.0

## Stack (never change without asking)
| Layer | Library | Version |
|---|---|---|
| Framework | Expo SDK 52 + React Native 0.76 New Architecture (bridgeless) | — |
| Language | TypeScript strict | — |
| Navigation | expo-router v4 + Drawer | — |
| Inference | LiteRT-LM (`com.google.ai.edge.litertlm` 0.11.0 — Edge Gallery's engine) — GPU, ungated `.litertlm` multimodal models. Built on Kotlin 1.9 via `-Xskip-metadata-version-check`. Native module `android/.../litert/LiteRtModule.kt`, JS `src/llm/LiteRtService.ts`, seam `src/llm/engine.ts`. LiteRT is the only active engine. | — |
| Voice | @react-native-voice/voice | 3.2.4 (patched) |
| Downloads | @kesha-antonov/react-native-background-downloader | 4.5.5 (patched) |
| State | Zustand + AsyncStorage persist | — |
| Markdown | react-native-marked | — |

## Key architectural rules

### Single native LLM session — no concurrency
`LiteRtService` serializes ONE active native generation. Chat, research, title generation, and Core extraction must go through:
- `generate()` → drains any active generation, then locks `activeCompletion`
- `extract()` → returns null if busy unless `preempt:true` drains first
- Native conversation cleanup happens at the start of the next generate/release, never inside LiteRT callbacks → avoids deadlocks

### New Architecture bridgeless — NativeModules is null
Native modules register as TurboModules under bridgeless. `NativeModules.Foo` is always null.
- `@react-native-voice/voice` → patched to use `TurboModuleRegistry.get('RCTVoice')` (patches/)
- `@kesha-antonov/react-native-background-downloader` → patched to fall back to TurboModule (patches/)
- `LiteRtService` must resolve `TurboModuleRegistry.get('LiteRt')` first, with legacy `NativeModules.LiteRt` only as a fallback.
- When adding any new native lib: check if it uses `NativeModules.X` — patch if so.

### AsyncStorage 2 MB row limit
Android SQLite `CursorWindow` = 2 MB per row. Never store image base64 in conversation rows.
- `forStorage()` in `storage/conversations.ts` strips `imageBase64` before write
- Images are copied to `${documentDirectory}chat-media/{id}.jpg` for durable display

### Context window / N_CTX
LiteRT is initialized with a 4096-token window. Silent `extract()→null` usually means the engine is busy or the prompt is too large.
- Research sources: capped at 1100 chars each, max 3 sources
- Extraction transcript: trimmed to 4000 chars total
- N_CTX maths: keep prompts + completion well under 4096 tokens

### Vision (multimodal) — built into the model
- LiteRT `.litertlm` bundles are multimodal in ONE file. NO separate vision pack, no mmproj.
- Vision is ready the moment the model loads. Images go to the native session via
  `Content.ImageBytes` / `BitmapImageBuilder` (no `<__media__>` marker — MediaPipe templates).
- Models: ungated `litert-community/gemma-4-{E2B,E4B}-it-litert-lm` `.litertlm` files (public CDN).

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
npm test          # Jest (43 suites / 538 tests verified 2026-07-14)
npm run typecheck # tsc --noEmit strict
```

## File layout
```
app/                        Routes: onboarding, (main) drawer, chat, settings
src/agent/                  Local agent ("Task" in UI): router, AgentKernel, refine, ToolRegistry, PolicyEngine, receipts (docs: ../docs/aether-local-agent-*.md)
src/llm/                    LiteRtService, engine seam, prompt helpers
src/voice/                  VoiceService
src/files/                  FileProcessor, PDF/docx extractors
src/webresearch/            DuckDuckGo→fetch→cite pipeline (safety.ts is the security chokepoint)
src/secondbrain/            Memory extraction + store
src/models/                 Model registry + ModelManager (download/verify/delete .litertlm files)
src/state/                  Zustand stores (useChatStore, useModelStore, useProfileStore)
src/hooks/                  useInference, useVoice, useAttachment
src/components/             UI components
src/theme/                  Design tokens
plugins/                    withAetherAndroid (Expo config plugin)
patches/                    patch-package patches for voice + downloader
```

## Known issues / next work
- Voice still unverified on all real devices — surface real error from `Voice.start()` throw
- Vision is LiteRT-session dependent: if the native ladder falls back text-only, surface that honestly.
- Second Brain auto-extraction often preempted; manual "Analyze now" button is the reliable path
- Reinit self-heal after hard crash exists (`reinit()`) — monitor for stability

## Coding rules (strict)
1. No comments unless WHY is non-obvious
2. No error handling for scenarios that can't happen
3. No feature flags, no backwards-compat shims
4. Don't add features beyond what's asked
5. Security: web text always sanitized via `safety.ts` before hitting any prompt (prompt-injection guard)
6. Patches go in `patches/` via patch-package; add to `postinstall` in package.json

## Design rules (visual quality — current top priority)

The current mission is to make Aether **beautiful, zero AI slop**. Improve existing
surfaces; do NOT add features. Full plan: `../claude-notes/design-northstar.md`.

1. **The bar is `ModelLoadingOverlay.tsx`.** Before shipping any UI change, ask: does
   this feel as crafted as the model-loading screen? If not, it's not done.
2. **Use the tokens, never magic numbers.** `spacing`, `radius`, `fontSize`,
   `lineHeight`, `motion`, `fonts` live in `src/theme/index.ts`. If a value you need
   isn't in the scale, add it to the scale — don't hardcode a literal.
3. **Every tappable surface gives feedback.** Press state (scale/opacity via `motion`
   tokens) and, where it fits, light haptics. No dead taps.
4. **Depth, not just borders.** Prefer the shared elevation language over flat
   rect + 1px border for cards/inputs where it adds polish.
5. **Theme-correct always.** Read colors via `useColors()`; never import `colors`
   directly in themed surfaces. Verify both dark and warm-paper light.
6. **Verify visually, on a real device.** Code-correct ≠ beautiful. Screenshot into
   `../design-artifacts/` and compare against the bar.

## GitHub
- Remote: `github.com/xcrrr/aether-mobile`
- Releases: APK uploaded via `gh release create vX.Y.Z` (never git-committed)
- Commit style: short imperative, no AI co-author footer needed unless explicitly asked
