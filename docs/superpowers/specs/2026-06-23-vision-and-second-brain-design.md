# Vision + Second Brain — Design Spec

Date: 2026-06-23
Status: Approved for planning
Scope: Two independent features in aetherbeta (`com.aether.app`). One spec, one plan.

## Problem

1. **Vision (image understanding) fails on device.** The model replies that it cannot
   see attached images even after the user downloaded the ~940 MB mmproj pack.
2. **Second Brain is unreliable and has no real UI.** Auto-extraction rarely saves
   anything; the screen is a flat category list. The user wants reliable learning,
   smarter facts, and an Obsidian-style interactive 3D graph as the primary view.

## Key finding (vision)

The bundled llama.rn 0.12.0-rc.6 arm64 `librnllama.so` **does** support gemma-3n
vision: it contains `clip_graph_mobilenetv5` (gemma-3n's vision encoder),
`llm_build_gemma3n_iswa`, `clip_init`, and the full `mtmd` image preprocessor set.
So the capability is present and the JS is wired (`initMultimodal`, `<__media__>`
marker, `media_paths`). The failure is a **silent config/data/error-handling bug**,
not a missing feature.

The decisive defect: **every vision error is swallowed.** `useInference.load` catches
vision-init errors into `console.error`; `LlamaService.generate` catches a media-decode
crash, calls `reinit()`, and silently retries text-only — which makes the model answer
"I can't see it." The user gets no signal about the true cause. We must instrument
before we can fix, since the failure is only reproducible on a real arm64 device.

---

## Part A — Vision

### Approach: instrument → fix likely causes → prove with a self-test

One device round-trip: ship an instrumented build, the user runs it once, it
self-reports the root cause and auto-fixes the common ones. No model swap, no backup
VLM (explicitly declined).

### A1. Surface vision errors (no more silent swallow)
- `initMultimodal` returns a result object `{ ok: boolean; error?: string }` instead of
  a bare boolean (or sets a module-level `lastVisionError`). The real llama.rn
  init/enable error string is captured, not just logged.
- `generate()` records when a media completion crashed and fell back to text-only, and
  exposes that as a `lastVisionError` ("image decode failed: …") so the UI can show it.
- Surface in two places: a Vision status line in Settings, and a one-time inline chat
  note the first time an image send falls back ("Couldn't read the image — <reason>").

### A2. mmproj integrity check
- After `startMmprojDownload` completes (and at `isMmprojInstalled`), verify the on-disk
  file: size within tolerance of `mmprojSizeBytes` AND first 4 bytes are the GGUF magic
  (`0x47 0x47 0x55 0x46` = "GGUF"). A truncated download or an HTML error page saved as
  `.gguf` is the classic silent cause of init failure.
- On corruption: delete the file, mark not installed, surface "vision pack was
  incomplete — re-download".

### A3. Config correction
- Re-evaluate `image_max_tokens: 512`. gemma-3n emits a fixed soft-token count; an
  arbitrary cap can corrupt or abort decode. Confirm the llama.rn `initMultimodal`
  signature during implementation and either remove the cap or set the model-correct
  value. `use_gpu: false` stays.

### A4. Vision self-test (turns "we hope" into a fact)
- Bundle one tiny known PNG asset (e.g. a solid red 64×64 square) at
  `assets/vision-selftest.png`.
- After a successful `initMultimodal`, run one silent completion via the existing
  single-context lock (kind `extract`, ~8 tokens, preempt-safe): "What color is this
  image? One word." A sane non-empty answer (or simply a non-crashing decode that emits
  tokens) sets `visionWorks = true`.
- The Vision status row shows one of: Not downloaded / Downloaded, verifying… /
  **Working** / Pack incomplete / Vision unavailable on this device (with the error).
- The honesty fallback in prompts is kept for the genuine unavailable case.

### A5. Components touched (Part A)
- `src/llm/LlamaService.ts` — richer `initMultimodal` result + `lastVisionError` + the
  self-test runner (reuses the completion lock).
- `src/models/ModelManager.ts` — mmproj integrity verification.
- `src/hooks/useInference.ts` — propagate vision status/error into the `vision` object
  (`works`, `error`).
- `src/components/settings/` (vision pack row) — show status/error.
- `src/components/chat/ChatInput.tsx` — one-time inline fallback note.
- `assets/vision-selftest.png` — new bundled asset.

### A6. Out of scope (Part A)
- No second/backup vision model (SmolVLM etc.).
- No change to the chat model registry or download flow beyond integrity check.

---

## Part B — Second Brain

### B1. Reliable auto-learning — dirty-queue + idle extraction
Replace fire-and-forget-after-every-reply (which loses the race to the next send) with
a queue:
- After each assistant reply, mark the conversation **dirty** (store its id + a snapshot
  reference).
- Run extraction only when the shared context is **idle** (no in-flight chat). If a
  send preempts it, the conversation stays dirty and is retried on the next idle.
- Additional safe triggers: app moves to background, and chat blur/unmount.
- The manual "Analyze now" button remains (forces `preempt:true`).
- Net effect: extraction completes in genuine gaps instead of being aborted mid-JSON.

### B2. Smarter extraction
- **Relationships:** the extractor also returns edges between facts (e.g.
  `business_name —located_in→ location`). These become graph edges. Prompt asks for an
  optional `"links"` array of `{from_key, to_key, relation}`.
- **Dedupe/merge:** upsert by `key` (already present) extended to merge values and take
  the higher confidence; near-duplicate keys collapse.
- **Reinforcement:** a fact re-observed in a later conversation bumps confidence and
  `lastSeenAt`.
- **Decay:** low-confidence facts not seen for a long window are flagged stale (not
  auto-deleted) so the graph can de-emphasize them.

### B3. Data model
- `MemoryStore` gains `edges: MemoryEdge[]` ( `{ id, fromKey, toKey, relation }` )
  alongside `entries`. Migration: existing persisted state loads with `edges: []`.
- `MemoryEntry` gains `lastSeenAt: number` (defaults to `createdAt`/`updatedAt` on load).

### B4. Obsidian-style 3D graph (primary view)
- **Tech:** `react-native-webview` hosting a **locally bundled** `three.js` +
  `3d-force-graph` HTML/JS asset. No CDN — fully offline (sovereign requirement). This
  is the chosen "make it work like Obsidian" path: real force physics, drag-to-rotate,
  pinch/scroll zoom, pan, node drag, idle auto-rotate — all native to 3d-force-graph,
  minimal custom code.
- **Asset:** `assets/graph/index.html` + bundled `three.min.js` +
  `3d-force-graph.min.js` (vendored, offline). Loaded into the WebView via
  `source={{ uri / require }}` as a local asset.
- **Data flow:**
  - RN → WebView: `postMessage({ nodes, links })`. Nodes = facts (id=key,
    label=value, color by category, size by confidence). Links = B2 edges.
  - WebView → RN: on node tap, `window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'nodeTap', key }))`.
- **Node tap:** read-only popup (chosen) showing the fact (category, key, value,
  confidence). Edit/delete stays in the list view.
- **Look:** dark background matched to Aether (`colors.bg`), nodes glowing and colored
  per category, thin translucent links, subtle bloom, slow idle rotation — visually
  matched to Obsidian's graph view.
- **View toggle:** Graph is the primary Second Brain view; the existing list is a
  secondary toggle (graph ⇄ list segmented control in the header). Empty state when no
  facts yet.

### B5. New dependency
- `react-native-webview` (Expo SDK 52-compatible ~13.x). Requires prebuild + a
  `plugins/withAetherAndroid.js` entry if needed and an APK rebuild. It is a
  well-supported Fabric component under the bridgeless New Architecture (unlike the
  voice/downloader libs, no `NativeModules` patch expected — verify during impl).

### B6. Components touched (Part B)
- `src/secondbrain/MemoryExtractor.ts` — links in prompt + parse; reinforcement.
- `src/secondbrain/MemoryStore.ts` + `types.ts` — `edges`, `lastSeenAt`, merge/decay,
  migration.
- `src/secondbrain/ExtractionQueue.ts` (new) — dirty-queue + idle scheduler.
- `src/hooks/useInference.ts` — enqueue dirty instead of immediate fire-and-forget;
  idle trigger hook.
- `src/components/secondbrain/Graph3D.tsx` (new) — WebView wrapper + bridge.
- `assets/graph/` (new) — vendored offline HTML/JS.
- `src/components/settings/SecondBrainScreen.tsx` — graph⇄list toggle, node popup.

### B7. Out of scope (Part B)
- No cloud sync, no cross-device memory.
- No editing of edges by hand (edges are extraction-derived only).
- No 2D graph mode.

---

## Invariants preserved (both parts)
1. ONE native llama context — all completions (chat, extract, vision self-test) go
   through the existing `activeCompletion` lock. The self-test uses the `extract` path.
2. `media_paths` computed before `drainActive()` — no new await between drain and lock.
3. AsyncStorage rows < 2 MB — graph data is small (facts/edges); no base64 ever stored.
4. N_CTX 8192 — extraction transcript + links prompt stays well under budget.
5. Honesty fallback when vision genuinely unavailable.
6. Web/text sanitization unchanged (not touched here).

## Testing
- Part A: unit-test integrity check (magic bytes/size), `initMultimodal` result mapping,
  self-test result→status mapping. Device run validates real decode.
- Part B: unit-test extraction-queue idle/dirty/retry logic, edge parse + validation,
  merge/reinforcement/decay, store migration. Graph WebView bridge messages
  (serialize nodes/links; parse nodeTap).
- `npm run typecheck` + `npm test` green before any build.

## Delivery
- Local arm64 APK via Gradle (per CLAUDE.md build recipe), force fresh Hermes bundle
  after JS/asset changes. One device run for Part A diagnosis.
