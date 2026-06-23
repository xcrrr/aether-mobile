# Vision Fix + Second Brain 3D Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make on-device image understanding actually work (and self-report when it can't), and turn the Second Brain into a reliable, smarter memory layer rendered as an Obsidian-style interactive 3D graph.

**Architecture:** Two independent feature tracks sharing the single llama.rn context.
Track A instruments and hardens the already-wired vision path (the build supports
gemma-3n vision via `clip_graph_mobilenetv5`; failures are silent). Track B replaces
fire-and-forget extraction with an idle dirty-queue, adds fact relationships + merge +
decay, and renders facts/edges in a WebView hosting a locally-bundled `3d-force-graph`.

**Tech Stack:** Expo SDK 52, RN 0.76.9 (bridgeless), TypeScript strict, llama.rn
0.12.0-rc.6, Zustand + AsyncStorage persist, Jest, react-native-webview 13.12.5,
3d-force-graph (vendored, offline).

**Invariants (never break):** ONE native context — all completions go through the
`activeCompletion` lock; `media_paths` computed before `drainActive()`; AsyncStorage
rows < 2 MB; honesty fallback when vision genuinely unavailable.

**Conventions:** Run `npm run typecheck` and `npm test` after each task. Commit per task.
Tests are TDD where the logic is pure (RED → GREEN). Device-only behavior is verified on
the one device run at the end of Track A.

---

## File Structure

**Track A — Vision**
- Modify `src/llm/LlamaService.ts` — `initMultimodal` returns a result; module-level
  `lastVisionError`; `runVisionSelfTest()`; `getVisionStatus()`.
- Create `src/llm/visionStatus.ts` — `VisionStatus` type + pure status-derivation fn.
- Modify `src/models/ModelManager.ts` — `verifyMmprojIntegrity()`; integrity check folded
  into `isMmprojInstalled` + post-download.
- Create `src/models/ggufCheck.ts` — pure GGUF magic-byte + size validation.
- Modify `src/hooks/useInference.ts` — surface vision status/error in the `vision` object.
- Modify `app/(main)/settings.tsx` — show vision status/error.
- Modify `src/components/chat/ChatInput.tsx` — one-time inline fallback note.
- Add `assets/vision-selftest.png` — bundled 64×64 solid-red test image.

**Track B — Second Brain data + extraction**
- Modify `src/secondbrain/types.ts` — `MemoryEdge`, `lastSeenAt`, `stale`.
- Modify `src/secondbrain/MemoryStore.ts` — `edges`, merge/reinforce, decay, migration.
- Modify `src/secondbrain/MemoryExtractor.ts` — parse `links`, reinforcement, return edges.
- Create `src/secondbrain/ExtractionQueue.ts` — dirty-set + idle scheduler.
- Modify `src/hooks/useInference.ts` — enqueue dirty instead of immediate extraction.
- Modify `src/llm/LlamaService.ts` — export `isBusy()` for the idle check.

**Track C — 3D Graph UI**
- Create `assets/graph/3d-force-graph.min.js` — vendored self-contained UMD (offline).
- Create `assets/graph/graph.html` — WebView page wiring the lib + bridge.
- Create `src/components/secondbrain/graphData.ts` — pure `entries+edges → {nodes,links}`.
- Create `src/components/secondbrain/Graph3D.tsx` — WebView wrapper + RN↔web bridge.
- Modify `src/components/settings/SecondBrainScreen.tsx` — graph⇄list toggle, node popup.
- Modify `plugins/withAetherAndroid.js` — only if webview needs a manifest/gradle tweak.
- Modify `package.json` — add `react-native-webview`; devDep `3d-force-graph`.

---

# TRACK A — VISION

## Task A1: GGUF integrity check (pure)

**Files:**
- Create: `src/models/ggufCheck.ts`
- Test: `src/models/ggufCheck.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/models/ggufCheck.test.ts
import { hasGgufMagic, isMmprojFileValid } from './ggufCheck';

describe('ggufCheck', () => {
  it('accepts the GGUF magic header (bytes 0x47475546)', () => {
    expect(hasGgufMagic('GGUF...rest')).toBe(true);
  });
  it('rejects an HTML error page saved as .gguf', () => {
    expect(hasGgufMagic('<!DOCTYPE html><html>404')).toBe(false);
  });
  it('rejects empty content', () => {
    expect(hasGgufMagic('')).toBe(false);
  });
  it('validates when magic present and size within 2% of expected', () => {
    expect(isMmprojFileValid({ headStr: 'GGUF', sizeBytes: 990_000_000, expectedBytes: 990_372_352 })).toBe(true);
  });
  it('invalidates a truncated file even with correct magic', () => {
    expect(isMmprojFileValid({ headStr: 'GGUF', sizeBytes: 12_000, expectedBytes: 990_372_352 })).toBe(false);
  });
  it('invalidates wrong magic regardless of size', () => {
    expect(isMmprojFileValid({ headStr: '<htm', sizeBytes: 990_372_352, expectedBytes: 990_372_352 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/ggufCheck.test.ts`
Expected: FAIL — "Cannot find module './ggufCheck'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/models/ggufCheck.ts
/** GGUF files begin with the ASCII magic "GGUF" (0x47 0x47 0x55 0x46). */
export function hasGgufMagic(head: string): boolean {
  return head.startsWith('GGUF');
}

/** A vision pack is valid when it carries the GGUF magic AND its on-disk size is
 *  within 2% of the expected size (guards truncated downloads / saved error pages). */
export function isMmprojFileValid(args: {
  headStr: string;
  sizeBytes: number;
  expectedBytes: number;
}): boolean {
  if (!hasGgufMagic(args.headStr)) return false;
  if (args.expectedBytes <= 0) return false;
  const ratio = args.sizeBytes / args.expectedBytes;
  return ratio >= 0.98 && ratio <= 1.02;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/ggufCheck.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/ggufCheck.ts src/models/ggufCheck.test.ts
git commit -m "feat(vision): pure GGUF integrity validator"
```

---

## Task A2: Wire integrity check into ModelManager

**Files:**
- Modify: `src/models/ModelManager.ts` (`isMmprojInstalled`, add `verifyMmprojIntegrity`)
- Test: `src/models/ModelManager.mmproj.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/models/ModelManager.mmproj.test.ts
import * as FileSystem from 'expo-file-system';
import { verifyMmprojIntegrity } from './ModelManager';
import { getModelById } from './registry';

jest.mock('expo-file-system');

const model = getModelById('gemma4-e2b')!;

describe('verifyMmprojIntegrity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns invalid when the file is missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    expect(await verifyMmprojIntegrity(model)).toEqual({ ok: false, reason: 'missing' });
  });

  it('returns invalid + deletes when magic bytes are wrong', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: model.mmprojSizeBytes });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('PCFE'); // base64-ish non-GGUF
    const res = await verifyMmprojIntegrity(model);
    expect(res.ok).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('returns ok for a valid GGUF of the right size', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: model.mmprojSizeBytes });
    // "GGUF" in base64 is "R0dVRg=="
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('R0dVRg==');
    expect(await verifyMmprojIntegrity(model)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/ModelManager.mmproj.test.ts`
Expected: FAIL — `verifyMmprojIntegrity` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/models/ModelManager.ts` add the import and function. The file's first bytes are
read as base64 and decoded to inspect the magic (expo-file-system has no length-limited
read; reading the leading 4 bytes via base64 of the whole file is too costly, so read the
file's first chunk by reading base64 and decoding only the head).

```ts
// add to imports
import { isMmprojFileValid } from './ggufCheck';
import { base64ToArrayBuffer } from '@/files/base64';

export interface MmprojIntegrity { ok: boolean; reason?: 'missing' | 'corrupt'; }

/** Verify a downloaded vision pack: present, GGUF magic, size within tolerance.
 *  Deletes a corrupt file so the UI can prompt a clean re-download. */
export async function verifyMmprojIntegrity(model: ModelDef): Promise<MmprojIntegrity> {
  const path = mmprojLocalPath(model);
  if (!path || !model.mmprojSizeBytes) return { ok: false, reason: 'missing' };
  const uri = `file://${path}`;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) return { ok: false, reason: 'missing' };
  const size = (info as { size?: number }).size ?? 0;

  // Read the whole file's leading bytes via base64; decode only the first 4 to ASCII.
  let headStr = '';
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 8, // first 8 bytes is plenty for the 4-byte magic
      position: 0,
    });
    const bytes = new Uint8Array(base64ToArrayBuffer(b64)).slice(0, 4);
    headStr = String.fromCharCode(...bytes);
  } catch {
    headStr = '';
  }

  const valid = isMmprojFileValid({ headStr, sizeBytes: size, expectedBytes: model.mmprojSizeBytes });
  if (!valid) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return { ok: false, reason: 'corrupt' };
  }
  return { ok: true };
}
```

> NOTE during impl: confirm `expo-file-system` `readAsStringAsync` honors `length`/`position`
> in SDK 52. If not, read the first ~64 bytes by reading the file and slicing — but DO NOT
> base64 the full ~940 MB. If `length` is unsupported, fall back to size+magic via a
> 1024-byte `position:0` read; adjust the test's mock accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/ModelManager.mmproj.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/ModelManager.ts src/models/ModelManager.mmproj.test.ts
git commit -m "feat(vision): mmproj integrity verification (magic + size)"
```

---

## Task A3: Vision status type + derivation (pure)

**Files:**
- Create: `src/llm/visionStatus.ts`
- Test: `src/llm/visionStatus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/llm/visionStatus.test.ts
import { deriveVisionStatus } from './visionStatus';

describe('deriveVisionStatus', () => {
  it('not-supported when the model has no vision', () => {
    expect(deriveVisionStatus({ supported: false, installed: false, ready: false, selfTestPassed: false, error: null }).kind)
      .toBe('unsupported');
  });
  it('not-downloaded when supported but pack absent', () => {
    expect(deriveVisionStatus({ supported: true, installed: false, ready: false, selfTestPassed: false, error: null }).kind)
      .toBe('not_downloaded');
  });
  it('verifying when installed + ready but self-test not done yet', () => {
    expect(deriveVisionStatus({ supported: true, installed: true, ready: true, selfTestPassed: false, error: null }).kind)
      .toBe('verifying');
  });
  it('working when self-test passed', () => {
    expect(deriveVisionStatus({ supported: true, installed: true, ready: true, selfTestPassed: true, error: null }).kind)
      .toBe('working');
  });
  it('error surfaces the failure string when ready failed', () => {
    const s = deriveVisionStatus({ supported: true, installed: true, ready: false, selfTestPassed: false, error: 'clip init failed' });
    expect(s.kind).toBe('error');
    expect(s.detail).toBe('clip init failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/llm/visionStatus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/llm/visionStatus.ts
export interface VisionFlags {
  supported: boolean;
  installed: boolean;
  ready: boolean;          // initMultimodal succeeded + isMultimodalEnabled true
  selfTestPassed: boolean; // a real image actually decoded
  error: string | null;
}

export type VisionStatusKind =
  | 'unsupported' | 'not_downloaded' | 'verifying' | 'working' | 'error';

export interface VisionStatus { kind: VisionStatusKind; detail?: string; }

export function deriveVisionStatus(f: VisionFlags): VisionStatus {
  if (!f.supported) return { kind: 'unsupported' };
  if (!f.installed) return { kind: 'not_downloaded' };
  if (!f.ready) return { kind: 'error', detail: f.error ?? 'Vision unavailable on this device.' };
  if (!f.selfTestPassed) {
    return f.error ? { kind: 'error', detail: f.error } : { kind: 'verifying' };
  }
  return { kind: 'working' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/llm/visionStatus.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/visionStatus.ts src/llm/visionStatus.test.ts
git commit -m "feat(vision): pure vision-status derivation"
```

---

## Task A4: Instrument LlamaService — surfaced errors + self-test

**Files:**
- Modify: `src/llm/LlamaService.ts`
- Add: `assets/vision-selftest.png` (64×64 solid red PNG)
- Test: `src/llm/LlamaService.vision.test.ts`

- [ ] **Step 1: Create the bundled self-test image**

Generate a 64×64 solid-red PNG and save to `assets/vision-selftest.png`:

```bash
node -e "const z=require('zlib');function chunk(t,d){const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const tb=Buffer.from(t);const crc=require('buffer');const c=Buffer.concat([tb,d]);let crc32=~0;for(const b of c){crc32^=b;for(let i=0;i<8;i++)crc32=(crc32>>>1)^(0xEDB88320&-(crc32&1));}const cb=Buffer.alloc(4);cb.writeUInt32BE((~crc32)>>>0);return Buffer.concat([len,c,cb]);}const W=64,H=64;const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;const raw=Buffer.alloc(H*(1+W*3));for(let y=0;y<H;y++){const off=y*(1+W*3);raw[off]=0;for(let x=0;x<W;x++){const p=off+1+x*3;raw[p]=255;raw[p+1]=0;raw[p+2]=0;}}const idat=z.deflateSync(raw);const png=Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);require('fs').writeFileSync('assets/vision-selftest.png',png);console.log('wrote',png.length,'bytes');"
```

Expected: "wrote <N> bytes"; `assets/vision-selftest.png` exists and opens as a red square.

- [ ] **Step 2: Write the failing test**

```ts
// src/llm/LlamaService.vision.test.ts
import { __setVisionTestHooks, getVisionStatus, runVisionSelfTest } from './LlamaService';

describe('vision self-test', () => {
  afterEach(() => __setVisionTestHooks(null));

  it('marks vision working when a decode returns non-empty tokens', async () => {
    __setVisionTestHooks({
      multimodalReady: true,
      selfTestImagePath: '/tmp/red.png',
      completion: async (_p: unknown, onTok: (t: { token?: string }) => void) => { onTok({ token: 'red' }); },
    });
    const ok = await runVisionSelfTest();
    expect(ok).toBe(true);
    expect(getVisionStatus().selfTestPassed).toBe(true);
  });

  it('records an error and fails the self-test when decode throws', async () => {
    __setVisionTestHooks({
      multimodalReady: true,
      selfTestImagePath: '/tmp/red.png',
      completion: async () => { throw new Error('mtmd decode failed'); },
    });
    const ok = await runVisionSelfTest();
    expect(ok).toBe(false);
    expect(getVisionStatus().error).toMatch(/mtmd decode failed/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/llm/LlamaService.vision.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 4: Implement instrumentation in `src/llm/LlamaService.ts`**

Add module state and functions. Keep the existing `activeCompletion` lock — the self-test
runs through the same single-context discipline (it is a one-shot, like `extract`).

```ts
// near the other module-level vision state
let lastVisionError: string | null = null;
let visionSelfTestPassed = false;

// Test seam so the self-test can be unit-tested without a native context.
interface VisionTestHooks {
  multimodalReady: boolean;
  selfTestImagePath: string;
  completion: (params: unknown, onTok: (t: { token?: string }) => void) => Promise<void>;
}
let visionTestHooks: VisionTestHooks | null = null;
export function __setVisionTestHooks(h: VisionTestHooks | null): void { visionTestHooks = h; }

export function getVisionStatus(): {
  ready: boolean; selfTestPassed: boolean; error: string | null;
} {
  return { ready: multimodalReady, selfTestPassed: visionSelfTestPassed, error: lastVisionError };
}
```

Change `initMultimodal` to capture the real error and reset the self-test flag:

```ts
export async function initMultimodal(mmprojPath: string): Promise<boolean> {
  if (!context) return false;
  lastVisionError = null;
  visionSelfTestPassed = false;
  const path = mmprojPath.replace(/^file:\/\//, '');
  const ctx = context as any;
  if (typeof ctx.initMultimodal !== 'function') {
    lastVisionError = 'This build has no multimodal support.';
    return false;
  }
  try {
    // image_min_tokens/image_max_tokens are for dynamic-resolution models; gemma-3n is
    // fixed (~256 soft tokens), so do NOT clamp below that. Leaving the cap generous (or
    // omitting it) avoids corrupting decode. Keep a high ceiling instead of 512.
    const ok = await ctx.initMultimodal({ path, use_gpu: false, image_max_tokens: 1024 });
    let enabled = ok !== false;
    if (typeof ctx.isMultimodalEnabled === 'function') {
      try { enabled = await ctx.isMultimodalEnabled(); } catch { /* keep ok */ }
    }
    multimodalReady = !!enabled;
    if (!multimodalReady) lastVisionError = 'Projector loaded but vision did not enable.';
  } catch (e) {
    lastVisionError = e instanceof Error ? e.message : String(e);
    multimodalReady = false;
  }
  return multimodalReady;
}
```

Add the self-test. It reuses the completion lock via `extract`-style serialization. The
bundled asset is resolved by the caller (useInference) and passed in; the test seam
injects a fake path + completion.

```ts
import { Asset } from 'expo-asset';

/** Resolve the bundled self-test image to a filesystem path llama.rn can read. */
async function selfTestImagePath(): Promise<string | null> {
  if (visionTestHooks) return visionTestHooks.selfTestImagePath;
  try {
    const asset = Asset.fromModule(require('../../assets/vision-selftest.png'));
    await asset.downloadAsync();
    return (asset.localUri ?? asset.uri).replace(/^file:\/\//, '');
  } catch { return null; }
}

/**
 * Prove vision really decodes: feed the bundled red square through one short
 * completion. Any emitted token means the projector decoded an image without
 * crashing → vision works. Records the failure reason otherwise.
 */
export async function runVisionSelfTest(): Promise<boolean> {
  const ready = visionTestHooks ? visionTestHooks.multimodalReady : multimodalReady;
  if (!ready) return false;
  const img = await selfTestImagePath();
  if (!img) { lastVisionError = 'Self-test image missing.'; return false; }

  const runCompletion = visionTestHooks
    ? visionTestHooks.completion
    : (params: unknown, onTok: (t: { token?: string }) => void) =>
        context!.completion(params as any, onTok).then(() => {});

  if (!visionTestHooks) await drainActive();
  let emitted = 0;
  const prompt = `<start_of_turn>user\n<__media__>\nWhat color is this image? One word.<end_of_turn>\n<start_of_turn>model\n`;
  try {
    if (!visionTestHooks) activeKind = 'extract';
    const run = runCompletion(
      { prompt, n_predict: 8, temperature: 0.1, stop: STOP, media_paths: [img] },
      (tr) => { if (tr.token != null) emitted++; },
    );
    if (!visionTestHooks) activeCompletion = run as Promise<void>;
    await run;
    visionSelfTestPassed = emitted > 0;
    if (!visionSelfTestPassed) lastVisionError = 'Image decoded but produced no output.';
    return visionSelfTestPassed;
  } catch (e) {
    lastVisionError = e instanceof Error ? e.message : 'vision self-test failed';
    visionSelfTestPassed = false;
    return false;
  } finally {
    if (!visionTestHooks) { activeCompletion = null; activeKind = null; }
  }
}
```

Also: in `generate()`, when the media completion crashes and falls back to text-only, set
`lastVisionError` so the UI can explain it. Find the media-crash branch (the
`if (mediaPaths.length && emitted === 0)` block) and at its top add:

```ts
        lastVisionError = `Image decode failed: ${msg}`;
        visionSelfTestPassed = false;
```

And reset on success: in the `onTok` path is too hot; instead in `releaseLlm()` reset all
three vision flags (already resets `multimodalReady`) — add `lastVisionError = null;
visionSelfTestPassed = false;`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/llm/LlamaService.vision.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full suite + typecheck**

Run: `npm run typecheck && npx jest src/llm`
Expected: PASS (existing LlamaService.test.ts still green — the lock invariant unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/llm/LlamaService.ts src/llm/LlamaService.vision.test.ts assets/vision-selftest.png
git commit -m "feat(vision): surface real errors + on-device decode self-test"
```

---

## Task A5: Surface vision status in useInference + Settings + chat note

**Files:**
- Modify: `src/hooks/useInference.ts`
- Modify: `app/(main)/settings.tsx`
- Modify: `src/components/chat/ChatInput.tsx`

- [ ] **Step 1: Extend the `vision` object in `useInference.ts`**

After a successful `initMultimodal` (in `load`, in `send`, and in `downloadVision.onDone`),
run the self-test and refresh status. Add state and wire it:

```ts
import { runVisionSelfTest, getVisionStatus } from '@/llm/LlamaService';
import { deriveVisionStatus } from '@/llm/visionStatus';
// add to imports: verifyMmprojIntegrity from ModelManager (MM.verifyMmprojIntegrity)

// new state
const [visionWorks, setVisionWorks] = useState(false);
const [visionError, setVisionError] = useState<string | null>(null);

// helper used after each successful init
const finishVisionInit = useCallback(async () => {
  const ok = await runVisionSelfTest();
  const st = getVisionStatus();
  setVisionWorks(ok);
  setVisionError(st.error);
}, []);
```

In `load`, after `setVisionReady(await Llama.initMultimodal(path))`, first verify the file:

```ts
        if (model.mmprojFilename) {
          const integ = await MM.verifyMmprojIntegrity(model);
          const inst = integ.ok;
          setVisionInstalled(inst);
          const path = MM.mmprojLocalPath(model);
          if (inst && path) {
            const ready = await Llama.initMultimodal(path);
            setVisionReady(ready);
            if (ready) await finishVisionInit();
            else setVisionError(Llama.getVisionStatus().error);
          } else if (integ.reason === 'corrupt') {
            setVisionError('Vision pack was incomplete — re-download it.');
          }
        }
```

Apply the same `finishVisionInit()` call after the lazy init in `send` and after
`initMultimodal` in `downloadVision.onDone`.

Extend the returned `vision` object and expose a derived status:

```ts
  const vision = {
    supported: model?.supportsVision ?? false,
    ready: visionReady,
    installed: visionInstalled,
    works: visionWorks,
    error: visionError,
    progress: visionProgress,
    sizeBytes: model?.mmprojSizeBytes ?? 0,
    status: deriveVisionStatus({
      supported: model?.supportsVision ?? false,
      installed: visionInstalled,
      ready: visionReady,
      selfTestPassed: visionWorks,
      error: visionError,
    }),
    download: downloadVision,
  };
```

- [ ] **Step 2: Show status in `app/(main)/settings.tsx`**

In the existing "Image understanding" section, render the status text from
`vision.status` (the screen already has access to model vision state via `useModelStore`;
add a per-model status line). Minimal addition — a status label mapping:

```tsx
// helper near the top of settings.tsx
const VISION_STATUS_LABEL: Record<string, string> = {
  unsupported: 'Not supported by this model',
  not_downloaded: 'Not downloaded',
  verifying: 'Verifying…',
  working: '✓ Working',
  error: 'Unavailable',
};
```

Render `VISION_STATUS_LABEL[status.kind]` and, when `status.kind === 'error'`, the
`status.detail` string in a muted sub-line under the vision pack row. (Settings derives the
same status via `deriveVisionStatus` using `useModelStore` install state + a cached
self-test result; if Settings has no live LlamaService status, show install state only and
defer "Working/Unavailable" to the chat screen which holds the live `useInference` vision
object.)

> Impl note: Settings shows install/download state (it owns `useModelStore`). The
> live `working`/`error` detail comes from `useInference` and is shown in the chat banner
> (Step 3). Keep Settings to: Not downloaded / Downloaded / Pack incomplete.

- [ ] **Step 3: One-time inline fallback note in `ChatInput.tsx`**

`ChatInput` already receives the `vision` object (it shows the "Enable image
understanding" banner). When `vision.installed && !vision.works && vision.error`, render a
single muted line below the composer: `Image reading failed: {vision.error}`. This replaces
the silent failure with an explanation. Do not block sending.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS. No new unit tests here (UI wiring); logic was tested in A1/A3/A4.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInference.ts "app/(main)/settings.tsx" src/components/chat/ChatInput.tsx
git commit -m "feat(vision): integrity-verify pack, self-test on load, surface status in UI"
```

---

# TRACK B — SECOND BRAIN (data + extraction)

## Task B1: Memory types — edges, lastSeenAt, stale

**Files:**
- Modify: `src/secondbrain/types.ts`
- Test: covered by store tests in B2.

- [ ] **Step 1: Edit `src/secondbrain/types.ts`**

```ts
export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  sourceConversationId: string;
  createdAt: number;
  updatedAt: number;
  timesReinforced: number;
  lastSeenAt: number;   // Unix ms — bumped each time the fact is re-observed
  stale?: boolean;      // low-confidence + long-unseen; de-emphasized in the graph
}

/** A directed relationship between two facts (by key), e.g. business —located_in→ city. */
export interface MemoryEdge {
  id: string;
  fromKey: string;
  toKey: string;
  relation: string;
}

export interface UserMemory {
  userId: string;
  entries: MemoryEntry[];
  edges: MemoryEdge[];
  lastExtractionAt: number;
  totalConversationsAnalyzed: number;
}
```

- [ ] **Step 2: Typecheck (will fail until B2)**

Run: `npm run typecheck`
Expected: FAIL — `MemoryStore.ts` doesn't set `edges`/`lastSeenAt` yet. Proceed to B2.

- [ ] **Step 3: Commit (with B2)** — commit types + store together at the end of B2.

---

## Task B2: MemoryStore — edges, merge/reinforce, decay, migration

**Files:**
- Modify: `src/secondbrain/MemoryStore.ts`
- Test: `src/secondbrain/MemoryStore.test.ts` (extend existing)

- [ ] **Step 1: Write the failing tests (append to existing file)**

```ts
// src/secondbrain/MemoryStore.test.ts — add a describe block
import { useMemoryStore } from './MemoryStore';

describe('MemoryStore edges + reinforcement + decay', () => {
  beforeEach(() => {
    useMemoryStore.setState({
      memory: { userId: 'u', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true, hydrated: true,
    });
  });

  it('reinforcing an existing key bumps timesReinforced, confidence and lastSeenAt', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.6, sourceConversationId: 'c1' });
    const t0 = useMemoryStore.getState().memory.entries[0].lastSeenAt;
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.8, sourceConversationId: 'c2' });
    const e = useMemoryStore.getState().memory.entries[0];
    expect(e.timesReinforced).toBe(1);
    expect(e.confidence).toBeGreaterThanOrEqual(0.8);
    expect(e.lastSeenAt).toBeGreaterThanOrEqual(t0);
    expect(useMemoryStore.getState().memory.entries).toHaveLength(1);
  });

  it('addEdge dedupes identical from→to→relation', () => {
    const s = useMemoryStore.getState();
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    expect(useMemoryStore.getState().memory.edges).toHaveLength(1);
  });

  it('deleting an entry removes its dangling edges', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.6, sourceConversationId: 'c1' });
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    const id = useMemoryStore.getState().memory.entries[0].id;
    s.deleteEntry(id);
    expect(useMemoryStore.getState().memory.edges).toHaveLength(0);
  });

  it('markStale flags low-confidence entries unseen past the window', () => {
    const old = Date.now() - 1000 * 60 * 60 * 24 * 120; // 120 days ago
    useMemoryStore.setState((st) => ({
      memory: { ...st.memory, entries: [{
        id: 'e1', category: 'context', key: 'k', value: 'v', confidence: 0.3,
        sourceConversationId: 'c', createdAt: old, updatedAt: old, timesReinforced: 0, lastSeenAt: old,
      }] },
    }));
    useMemoryStore.getState().markStale();
    expect(useMemoryStore.getState().memory.entries[0].stale).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/secondbrain/MemoryStore.test.ts`
Expected: FAIL — `addEdge`/`markStale` missing; `edges` undefined; `lastSeenAt` unset.

- [ ] **Step 3: Implement in `MemoryStore.ts`**

Update `emptyMemory`, `addOrUpdateEntry`, `deleteEntry`, `clearAll`; add `addEdge`,
`markStale`; extend the interface and migration.

```ts
import { MemoryCategory, MemoryEntry, MemoryEdge, UserMemory } from './types';

const STALE_WINDOW_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const STALE_CONFIDENCE = 0.4;

function emptyMemory(): UserMemory {
  return { userId: uuid(), entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 };
}

// in the interface:
//   addEdge: (edge: Omit<MemoryEdge, 'id'>) => void;
//   markStale: () => void;

// addOrUpdateEntry — reinforce path:
addOrUpdateEntry: (entry) => {
  const now = Date.now();
  const entries = [...get().memory.entries];
  const idx = entries.findIndex((e) => e.category === entry.category && e.key === entry.key);
  if (idx >= 0) {
    const prev = entries[idx];
    entries[idx] = {
      ...prev,
      value: entry.value,
      // reinforcement: never lower confidence on re-observation; nudge upward.
      confidence: Math.min(1, Math.max(prev.confidence, entry.confidence) + 0.05),
      sourceConversationId: entry.sourceConversationId,
      updatedAt: now,
      lastSeenAt: now,
      stale: false,
      timesReinforced: prev.timesReinforced + 1,
    };
  } else {
    entries.push({
      ...entry, id: uuid(), createdAt: now, updatedAt: now, lastSeenAt: now, timesReinforced: 0,
    });
  }
  set({ memory: { ...get().memory, entries } });
},

addEdge: (edge) => {
  const edges = [...(get().memory.edges ?? [])];
  if (edges.some((e) => e.fromKey === edge.fromKey && e.toKey === edge.toKey && e.relation === edge.relation)) return;
  edges.push({ ...edge, id: uuid() });
  set({ memory: { ...get().memory, edges } });
},

deleteEntry: (id) => {
  const entries = get().memory.entries.filter((e) => e.id !== id);
  const keys = new Set(entries.map((e) => e.key));
  const edges = (get().memory.edges ?? []).filter((e) => keys.has(e.fromKey) && keys.has(e.toKey));
  set({ memory: { ...get().memory, entries, edges } });
},

clearAll: () => set({ memory: { ...get().memory, entries: [], edges: [] } }),

markStale: () => {
  const now = Date.now();
  const entries = get().memory.entries.map((e) =>
    e.confidence < STALE_CONFIDENCE && now - e.lastSeenAt > STALE_WINDOW_MS ? { ...e, stale: true } : e,
  );
  set({ memory: { ...get().memory, entries } });
},
```

Migration in `onRehydrateStorage` — backfill new fields on legacy payloads:

```ts
onRehydrateStorage: () => (state) => {
  if (state) {
    if (!state.memory?.userId) state.memory = emptyMemory();
    if (!Array.isArray(state.memory.edges)) state.memory.edges = [];
    state.memory.entries = (state.memory.entries ?? []).map((e) => ({
      ...e,
      lastSeenAt: e.lastSeenAt ?? e.updatedAt ?? e.createdAt ?? Date.now(),
    }));
    state.hydrated = true;
  }
},
```

Add the non-hook `MemoryStore` accessors for `addEdge` and `markStale`, plus a
`getAllEdges: () => useMemoryStore.getState().memory.edges`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm run typecheck && npx jest src/secondbrain/MemoryStore.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/secondbrain/types.ts src/secondbrain/MemoryStore.ts src/secondbrain/MemoryStore.test.ts
git commit -m "feat(secondbrain): edges, reinforcement, decay + store migration"
```

---

## Task B3: Extractor — parse relationship links + write edges

**Files:**
- Modify: `src/secondbrain/MemoryExtractor.ts`
- Test: `src/secondbrain/MemoryExtractor.test.ts` (extend)

- [ ] **Step 1: Write failing tests (append)**

```ts
// add to src/secondbrain/MemoryExtractor.test.ts
import { parseLinks } from './MemoryExtractor';

describe('parseLinks', () => {
  it('extracts a links array of {from_key,to_key,relation}', () => {
    const raw = '{"facts":[],"links":[{"from_key":"business_name","to_key":"city","relation":"located_in"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'business_name', toKey: 'city', relation: 'located_in' }]);
  });
  it('returns [] when no links present', () => {
    expect(parseLinks('[{"category":"identity","key":"x","value":"y","confidence":0.9}]')).toEqual([]);
  });
  it('skips malformed link objects', () => {
    const raw = '{"links":[{"from_key":"a"},{"from_key":"a","to_key":"b","relation":"r"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'a', toKey: 'b', relation: 'r' }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/secondbrain/MemoryExtractor.test.ts -t parseLinks`
Expected: FAIL — `parseLinks` not exported.

- [ ] **Step 3: Implement**

Extend `PROMPT_TEMPLATE` to request an optional links array, and the output shape. Keep
backward compatibility: still accept a bare array of facts (legacy). The new preferred
output is an object `{ "facts": [...], "links": [...] }`; `parseEntries` already handles a
top-level array OR object — extend it to read `facts` from an object.

```ts
// PROMPT_TEMPLATE — replace the "Output ONLY a raw JSON array" paragraph with:
'Output ONLY raw JSON (no prose, no markdown fences) as an object with two keys: ' +
'"facts" (array; each item has exactly "category", "key", "value", "confidence") and ' +
'"links" (array; each item has "from_key", "to_key", "relation" — a short relationship ' +
'between two fact keys, e.g. {"from_key":"business_name","to_key":"city","relation":"located_in"}). ' +
'Use [] for either when empty. Only include facts clearly stated or strongly implied — never invent.\n\n' +
// update the example output accordingly:
'Example output:\n' +
'{"facts":[{"category":"identity","key":"business_name","value":"Mitruk barber shop","confidence":0.95},' +
'{"category":"identity","key":"city","value":"Warsaw","confidence":0.9},' +
'{"category":"goals","key":"current_goal","value":"grow the barber shop on Instagram","confidence":0.9}],' +
'"links":[{"from_key":"business_name","to_key":"city","relation":"located_in"}]}\n\n' +
```

Update `parseEntries` to also accept an object with a `facts` array:

```ts
export function parseEntries(raw: string): unknown[] | null {
  // object form: { facts: [...], links: [...] }
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1)));
      if (obj && typeof obj === 'object' && Array.isArray((obj as any).facts)) return (obj as any).facts;
    } catch { /* fall through */ }
  }
  // legacy: bare array
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(tidyJson(raw.slice(start, end + 1)));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  // single bare object (a lone fact)
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1)));
      if (obj && typeof obj === 'object' && !Array.isArray((obj as any).facts)) return [obj];
    } catch { return null; }
  }
  return null;
}

export interface ParsedLink { fromKey: string; toKey: string; relation: string; }

/** Pull the optional relationship links from a response object. Returns [] if none. */
export function parseLinks(raw: string): ParsedLink[] {
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart < 0 || objEnd <= objStart) return [];
  let obj: any;
  try { obj = JSON.parse(tidyJson(raw.slice(objStart, objEnd + 1))); } catch { return []; }
  const links = Array.isArray(obj?.links) ? obj.links : [];
  const out: ParsedLink[] = [];
  for (const l of links) {
    if (l && typeof l.from_key === 'string' && typeof l.to_key === 'string' && typeof l.relation === 'string') {
      out.push({ fromKey: l.from_key, toKey: l.to_key, relation: l.relation });
    }
  }
  return out;
}
```

In `extractFromConversation`, after applying facts, add edges (only between keys that now
exist):

```ts
  const links = parseLinks(response);
  if (links.length) {
    const keys = new Set(MemoryStore.getAllEntries().map((e) => e.key));
    for (const l of links) {
      if (keys.has(l.fromKey) && keys.has(l.toKey)) {
        MemoryStore.addEdge({ fromKey: l.fromKey, toKey: l.toKey, relation: l.relation });
      }
    }
  }
```

Bump `MAX_EXTRACT_TOKENS` from 256 to 320 to fit the links array. (Still well within the
inter-message gap and N_CTX.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npm run typecheck && npx jest src/secondbrain/MemoryExtractor.test.ts`
Expected: PASS (existing + 3 new; existing parseEntries tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/secondbrain/MemoryExtractor.ts src/secondbrain/MemoryExtractor.test.ts
git commit -m "feat(secondbrain): extract fact relationships as graph edges"
```

---

## Task B4: Extraction queue — idle, dirty, retry

**Files:**
- Create: `src/secondbrain/ExtractionQueue.ts`
- Modify: `src/llm/LlamaService.ts` (export `isBusy`)
- Modify: `src/hooks/useInference.ts` (enqueue instead of immediate)
- Test: `src/secondbrain/ExtractionQueue.test.ts`

- [ ] **Step 1: Add `isBusy` to `LlamaService.ts`**

```ts
/** True while ANY completion (chat or extraction) holds the single context. */
export const isBusy = (): boolean => activeCompletion !== null;
```

- [ ] **Step 2: Write the failing test**

```ts
// src/secondbrain/ExtractionQueue.test.ts
import { ExtractionQueue } from './ExtractionQueue';

describe('ExtractionQueue', () => {
  it('runs a dirty conversation once the context is idle', async () => {
    let busy = true;
    const runs: string[] = [];
    const q = new ExtractionQueue({
      isBusy: () => busy,
      extract: async (id) => { runs.push(id); return 2; },
      pollMs: 5,
    });
    q.markDirty('c1');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual([]);          // still busy → not run
    busy = false;
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual(['c1']);      // idle → ran once
    q.stop();
  });

  it('keeps a conversation dirty and retries if extraction throws', async () => {
    let fail = true;
    const runs: string[] = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      extract: async (id) => { runs.push(id); if (fail) { fail = false; throw new Error('preempted'); } return 1; },
      pollMs: 5,
    });
    q.markDirty('c1');
    await new Promise((r) => setTimeout(r, 30));
    expect(runs.filter((r) => r === 'c1').length).toBeGreaterThanOrEqual(2);
    q.stop();
  });

  it('dedupes repeated markDirty for the same id', async () => {
    const runs: string[] = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      extract: async (id) => { runs.push(id); return 0; },
      pollMs: 5,
    });
    q.markDirty('c1'); q.markDirty('c1'); q.markDirty('c1');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual(['c1']);
    q.stop();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/secondbrain/ExtractionQueue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/secondbrain/ExtractionQueue.ts
export interface ExtractionQueueOptions {
  isBusy: () => boolean;
  /** Run extraction for a conversation; resolves the number of facts applied. */
  extract: (conversationId: string) => Promise<number>;
  pollMs?: number;
}

/**
 * Reliable Second Brain extraction. Conversations are marked dirty after each
 * reply; the queue drains them only when the shared llama context is idle, so an
 * extraction is never aborted mid-JSON by the next chat send. A failed/preempted
 * run leaves the conversation dirty for the next idle tick.
 */
export class ExtractionQueue {
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly opts: Required<ExtractionQueueOptions>;

  constructor(opts: ExtractionQueueOptions) {
    this.opts = { pollMs: 1500, ...opts };
  }

  markDirty(conversationId: string): void {
    this.dirty.add(conversationId);
    this.ensureTimer();
  }

  /** Force an immediate drain attempt (e.g. on app background / chat blur). */
  flush(): void { void this.drain(); }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.drain(); }, this.opts.pollMs);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    if (this.dirty.size === 0) { this.stop(); return; }
    if (this.opts.isBusy()) return;
    this.draining = true;
    try {
      const id = this.dirty.values().next().value as string;
      // Remove before running; re-add on failure so it retries next tick.
      this.dirty.delete(id);
      try {
        await this.opts.extract(id);
      } catch {
        this.dirty.add(id);
      }
    } finally {
      this.draining = false;
      if (this.dirty.size === 0) this.stop();
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/secondbrain/ExtractionQueue.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire into `useInference.ts`**

Replace the immediate `runMemoryExtraction()` with the queue. Create a module-singleton
queue that reads the live conversation snapshot at drain time:

```ts
import { ExtractionQueue } from '@/secondbrain/ExtractionQueue';
import { isBusy } from '@/llm/LlamaService';

const extractionQueue = new ExtractionQueue({
  isBusy,
  extract: async (conversationId) => {
    const convo = useChatStore.getState().current;
    const messages = convo && convo.id === conversationId ? convo.messages : [];
    if (!messages.length) return 0;
    return extractFromConversation(messages, conversationId);
  },
});

function queueMemoryExtraction(): void {
  const convo = useChatStore.getState().current;
  if (convo) extractionQueue.markDirty(convo.id);
}
```

In `send`'s `onDone`, replace `.then(runMemoryExtraction)` with `.then(queueMemoryExtraction)`.
Add an `AppState` listener (in a `useEffect`) that calls `extractionQueue.flush()` when the
app backgrounds:

```ts
import { AppState } from 'react-native';
useEffect(() => {
  const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') extractionQueue.flush(); });
  return () => sub.remove();
}, []);
```

Remove the now-unused `runMemoryExtraction` function.

- [ ] **Step 7: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/secondbrain/ExtractionQueue.ts src/secondbrain/ExtractionQueue.test.ts src/llm/LlamaService.ts src/hooks/useInference.ts
git commit -m "feat(secondbrain): idle dirty-queue extraction (reliable auto-learning)"
```

---

# TRACK C — 3D GRAPH UI

## Task C1: Add deps + vendor the offline graph library

**Files:**
- Modify: `package.json`
- Create: `assets/graph/3d-force-graph.min.js`
- Create: `assets/graph/graph.html`

- [ ] **Step 1: Install**

```bash
export JAVA_HOME=/home/xcrr1/android-studio-panda3-linux/android-studio/jbr
npx expo install react-native-webview
npm install --save-dev 3d-force-graph
```

Expected: `react-native-webview` resolves to the SDK-52 pin (13.12.5); `3d-force-graph` in devDependencies.

- [ ] **Step 2: Vendor the self-contained UMD build (offline at runtime)**

The `3d-force-graph` dist bundles its own three.js — a single self-contained file.

```bash
mkdir -p assets/graph
cp node_modules/3d-force-graph/dist/3d-force-graph.min.js assets/graph/3d-force-graph.min.js
ls -la assets/graph/3d-force-graph.min.js
```

Expected: file present (~1 MB). This is committed so the app works fully offline.

- [ ] **Step 3: Create the WebView page `assets/graph/graph.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #0B0B0F; overflow: hidden; }
  #graph { width: 100vw; height: 100vh; }
</style>
<script src="3d-force-graph.min.js"></script>
</head>
<body>
<div id="graph"></div>
<script>
  var Graph = ForceGraph3D()(document.getElementById('graph'))
    .backgroundColor('#0B0B0F')
    .nodeLabel('label')
    .nodeColor(function (n) { return n.color; })
    .nodeVal(function (n) { return n.val; })
    .nodeOpacity(0.95)
    .linkColor(function () { return 'rgba(160,160,200,0.35)'; })
    .linkWidth(0.6)
    .linklabel('relation')
    .enableNodeDrag(true)
    .onNodeClick(function (n) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nodeTap', key: n.id }));
      }
    });

  // Slow idle auto-rotate, like Obsidian's graph.
  var angle = 0;
  setInterval(function () {
    var dist = 220;
    angle += 0.0015;
    Graph.cameraPosition({ x: dist * Math.sin(angle), z: dist * Math.cos(angle) });
  }, 30);

  function setData(payload) {
    try {
      var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      Graph.graphData({ nodes: data.nodes || [], links: data.links || [] });
    } catch (e) {}
  }
  // RN → web bridge: both injectedJavaScript (window.__setGraphData) and message events.
  window.__setGraphData = setData;
  document.addEventListener('message', function (e) { setData(e.data); });
  window.addEventListener('message', function (e) { setData(e.data); });

  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json assets/graph/3d-force-graph.min.js assets/graph/graph.html
git commit -m "chore(graph): add react-native-webview + vendor offline 3d-force-graph"
```

---

## Task C2: Pure graph-data mapping

**Files:**
- Create: `src/components/secondbrain/graphData.ts`
- Test: `src/components/secondbrain/graphData.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/secondbrain/graphData.test.ts
import { toGraphData, CATEGORY_COLORS } from './graphData';
import { MemoryEntry, MemoryEdge } from '@/secondbrain/types';

const entry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  id: over.id ?? 'i', category: over.category ?? 'identity', key: over.key ?? 'k',
  value: over.value ?? 'v', confidence: over.confidence ?? 0.8, sourceConversationId: 'c',
  createdAt: 0, updatedAt: 0, lastSeenAt: 0, timesReinforced: 0, ...over,
});

describe('toGraphData', () => {
  it('maps entries to nodes colored by category and sized by confidence', () => {
    const { nodes } = toGraphData([entry({ key: 'city', category: 'identity', confidence: 0.9 })], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'city', label: 'v', color: CATEGORY_COLORS.identity });
    expect(nodes[0].val).toBeGreaterThan(0);
  });
  it('keeps only links whose endpoints both exist as nodes', () => {
    const entries = [entry({ key: 'a' }), entry({ key: 'b', id: 'i2' })];
    const edges: MemoryEdge[] = [
      { id: 'e1', fromKey: 'a', toKey: 'b', relation: 'r' },
      { id: 'e2', fromKey: 'a', toKey: 'ghost', relation: 'r' },
    ];
    const { links } = toGraphData(entries, edges);
    expect(links).toEqual([{ source: 'a', target: 'b', relation: 'r' }]);
  });
  it('dims stale nodes', () => {
    const { nodes } = toGraphData([entry({ key: 'old', stale: true })], []);
    expect(nodes[0].opacity).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/components/secondbrain/graphData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/components/secondbrain/graphData.ts
import { MemoryCategory, MemoryEntry, MemoryEdge } from '@/secondbrain/types';

export const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: '#7C3AED', personality: '#EC4899', preferences: '#F59E0B', goals: '#10B981',
  knowledge: '#3B82F6', relationships: '#EF4444', patterns: '#06B6D4', emotional: '#F472B6',
  context: '#8B5CF6',
};

export interface GraphNode { id: string; label: string; color: string; val: number; opacity: number; }
export interface GraphLink { source: string; target: string; relation: string; }
export interface GraphData { nodes: GraphNode[]; links: GraphLink[]; }

/** Map memory entries + edges to the 3d-force-graph shape (pure). */
export function toGraphData(entries: MemoryEntry[], edges: MemoryEdge[]): GraphData {
  const nodes: GraphNode[] = entries.map((e) => ({
    id: e.key,
    label: e.value,
    color: CATEGORY_COLORS[e.category],
    val: 1 + e.confidence * 4 + e.timesReinforced,
    opacity: e.stale ? 0.4 : 0.95,
  }));
  const keys = new Set(entries.map((e) => e.key));
  const links: GraphLink[] = edges
    .filter((e) => keys.has(e.fromKey) && keys.has(e.toKey))
    .map((e) => ({ source: e.fromKey, target: e.toKey, relation: e.relation }));
  return { nodes, links };
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/components/secondbrain/graphData.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/secondbrain/graphData.ts src/components/secondbrain/graphData.test.ts
git commit -m "feat(graph): pure memory→graph-data mapping"
```

---

## Task C3: Graph3D WebView component

**Files:**
- Create: `src/components/secondbrain/Graph3D.tsx`

- [ ] **Step 1: Implement the component**

Loads the bundled HTML + vendored JS via expo-asset, feeds graph data through
`injectedJavaScript` / `injectJavaScript`, and reports node taps to the parent.

```tsx
// src/components/secondbrain/Graph3D.tsx
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { GraphData } from './graphData';
import { colors } from '@/theme';

interface Props { data: GraphData; onNodeTap: (key: string) => void; }

export function Graph3D({ data, onNodeTap }: Props) {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  // Resolve the bundled HTML + its sibling JS to local file:// uris so the
  // WebView loads everything offline (relative <script src> resolves alongside).
  useEffect(() => {
    (async () => {
      const [html] = await Asset.loadAsync([
        require('../../../assets/graph/graph.html'),
        require('../../../assets/graph/3d-force-graph.min.js'),
      ]);
      setUri(html.localUri ?? html.uri);
    })();
  }, []);

  // Push data whenever it changes (and once the page is ready).
  const payload = JSON.stringify(data);
  useEffect(() => {
    ref.current?.injectJavaScript(`window.__setGraphData && window.__setGraphData(${JSON.stringify(payload)}); true;`);
  }, [payload]);

  if (!uri) return <View style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <WebView
        ref={ref}
        source={{ uri }}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        style={styles.fill}
        containerStyle={{ backgroundColor: colors.bg }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'ready') {
              ref.current?.injectJavaScript(`window.__setGraphData(${JSON.stringify(payload)}); true;`);
            } else if (msg.type === 'nodeTap' && typeof msg.key === 'string') {
              onNodeTap(msg.key);
            }
          } catch { /* ignore non-JSON */ }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg } });
```

> Impl fallback: if Android fails to load the relative `<script src>` from the asset
> file:// uri, inline the vendored JS directly into the HTML string and use
> `source={{ html }}` instead of `{{ uri }}` (read the vendored file via
> `Asset`+`FileSystem.readAsStringAsync` once and interpolate into a `<script>` tag).
> The bridge + data flow stay identical.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/secondbrain/Graph3D.tsx
git commit -m "feat(graph): Graph3D WebView wrapper + RN↔web bridge"
```

---

## Task C4: Wire graph into SecondBrainScreen (graph primary, list secondary, node popup)

**Files:**
- Modify: `src/components/settings/SecondBrainScreen.tsx`

- [ ] **Step 1: Add a view toggle + graph + node popup**

Add state for the current view (`'graph' | 'list'`, default `'graph'`), build graph data
from the store, render `Graph3D` as primary with a segmented toggle in the header, and a
read-only popup (Modal) on node tap.

```tsx
// new imports
import { Graph3D } from '@/components/secondbrain/Graph3D';
import { toGraphData } from '@/components/secondbrain/graphData';
import { Modal } from 'react-native';

// inside the component:
const edges = useMemoryStore((s) => s.memory.edges);
const [view, setView] = useState<'graph' | 'list'>('graph');
const [selected, setSelected] = useState<MemoryEntry | null>(null);

const graph = toGraphData(entries, edges ?? []);
const onNodeTap = (key: string) => {
  const e = entries.find((x) => x.key === key);
  if (e) setSelected(e);
};
```

In the header, render a two-button segmented control (Graph | List) that sets `view`.
When `enabled && entries.length > 0 && view === 'graph'`, render:

```tsx
<View style={{ flex: 1, minHeight: 380 }}>
  <Graph3D data={graph} onNodeTap={onNodeTap} />
</View>
```

Keep the existing grouped list, but only render it when `view === 'list'`. The empty state
("Nothing learned yet…") shows for both views when `entries.length === 0`.

Node popup (read-only) — Modal showing category, key, value, confidence:

```tsx
<Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
  <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
    <View style={styles.modalCard}>
      {selected && (
        <>
          <Text style={styles.label}>{selected.category}</Text>
          <Text style={styles.entryKey}>{selected.key}</Text>
          <Text style={[styles.entryValue, { marginTop: 6 }]}>{selected.value}</Text>
          <Text style={[styles.confidenceText, { marginTop: 10 }]}>
            {Math.round(selected.confidence * 100)}% confident
            {selected.stale ? ' · stale' : ''}
          </Text>
        </>
      )}
    </View>
  </Pressable>
</Modal>
```

Add styles `modalBackdrop` (flex:1, center, `rgba(0,0,0,0.6)`) and `modalCard`
(`backgroundColor: colors.bgCard`, padding `spacing.lg`, `borderRadius: radius.lg`,
`width: '80%'`).

Keep the "Analyze current chat now" button and the Clear-all button as they are.

- [ ] **Step 2: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SecondBrainScreen.tsx
git commit -m "feat(secondbrain): 3D graph as primary view, list secondary, node popup"
```

---

# FINAL: build, prebuild, device run

## Task D1: Prebuild + APK + device verification

- [ ] **Step 1: Prebuild (picks up react-native-webview autolink)**

```bash
export JAVA_HOME=/home/xcrr1/android-studio-panda3-linux/android-studio/jbr
npx expo prebuild --platform android --no-install
```

Expected: `android/` regenerated; webview present in `settings.gradle`. If `withAetherAndroid.js`
needs no change for webview (no manifest/gradle tweak), leave the plugin as-is.

- [ ] **Step 2: Force a fresh Hermes bundle + assemble (per CLAUDE.md recipe)**

```bash
rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets \
       android/app/build/intermediates/assets/release \
       android/app/build/intermediates/merged_assets/release
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && cd ..
cp android/app/build/outputs/apk/release/app-release.apk ~/aetherbeta-latest.apk
```

Expected: BUILD SUCCESSFUL; APK copied.

- [ ] **Step 3: Device verification checklist (the single device round-trip)**

Install `~/aetherbeta-latest.apk` on the arm64 8 GB phone and confirm:
1. **Vision:** open chat, attach a photo. If the pack isn't downloaded → "Enable image
   understanding" banner; download it. After load, Settings shows the pack downloaded, and
   sending an image either gets a real description (working) OR the chat shows
   `Image reading failed: <reason>` — capture that exact reason (this is the diagnostic
   the instrumentation was built to produce).
2. **Second Brain:** chat a few personal facts, wait (don't tap Analyze) → facts appear
   without the manual button (idle queue). The Second Brain screen opens on the 3D graph,
   which rotates, and responds to drag-rotate / pinch-zoom / node-drag; tapping a node
   shows the read-only popup. Toggle to List view works.

- [ ] **Step 4: Report results**

Relay the vision diagnostic string (if any) and graph/second-brain behavior. If vision
reports a concrete decode error, that becomes the next targeted fix (no blind rebuilds).

---

## Self-Review notes (author)
- Spec A1 (surface errors) → A4 (`lastVisionError`, generate() fallback sets it) + A5 (UI).
- Spec A2 (integrity) → A1 (pure) + A2 (wired). A3 (config) → A4 (`image_max_tokens` 1024).
  A4 (self-test) → A4 + A5.
- Spec B1 (reliable) → B4 queue. B2 (smarter) → B2 reinforce/decay + B3 links. B3 (data
  model) → B1 types + B2 store. B4 (graph) → C1–C4. B5 (dep) → C1. Node tap read-only → C4.
- Type consistency: `toGraphData`, `CATEGORY_COLORS`, `GraphData/GraphNode/GraphLink`,
  `MemoryEdge {fromKey,toKey,relation}`, `ParsedLink {fromKey,toKey,relation}`,
  `addEdge(Omit<MemoryEdge,'id'>)`, `markStale`, `isBusy`, `getVisionStatus`,
  `runVisionSelfTest`, `deriveVisionStatus`, `verifyMmprojIntegrity` — names used
  consistently across tasks.
