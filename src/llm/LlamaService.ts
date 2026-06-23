import { initLlama, type LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Message } from '@/types';
import { buildGemmaPrompt, trimToContext } from './prompt';
import { assertRAMSufficient } from '@/utils/ramCheck';

/**
 * True once a multimodal projector (mmproj) has been loaded for the current
 * context. Image attachments are only forwarded to the model when this is set;
 * with a text-only GGUF (no projector) we still inject a text note via the
 * prompt, but the pixels are not sent.
 */
let multimodalReady = false;
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

/**
 * Load a multimodal projector so the active model can analyze images. Safe to
 * call repeatedly; returns whether vision is available afterwards. Requires a
 * loaded context and an mmproj file on disk.
 */
export async function initMultimodal(mmprojPath: string): Promise<boolean> {
  if (!context) return false;
  lastVisionError = null;
  visionSelfTestPassed = false;
  const path = mmprojPath.replace(/^file:\/\//, '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = context as any;
  if (typeof ctx.initMultimodal !== 'function') {
    lastVisionError = 'This build has no multimodal support.';
    return false;
  }
  try {
    // image_max_tokens/image_min_tokens are for dynamic-resolution models; gemma-3n is
    // fixed (~256 soft tokens), so do NOT clamp below that. Keep a generous ceiling
    // (1024) instead of the prior 512 which could corrupt decode.
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
 * crashing -> vision works. Records the failure reason otherwise.
 */
export async function runVisionSelfTest(): Promise<boolean> {
  const ready = visionTestHooks ? visionTestHooks.multimodalReady : multimodalReady;
  if (!ready) return false;
  const img = await selfTestImagePath();
  if (!img) { lastVisionError = 'Self-test image missing.'; return false; }

  const runCompletion = visionTestHooks
    ? visionTestHooks.completion
    : (params: unknown, onTok: (t: { token?: string }) => void) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    lastVisionError = e instanceof Error ? e.message : String(e);
    visionSelfTestPassed = false;
    return false;
  } finally {
    if (!visionTestHooks) { activeCompletion = null; activeKind = null; }
  }
}

export const isMultimodalReady = (): boolean => multimodalReady;

/** Persist image attachments to cache files for the multimodal API. */
async function writeImagePaths(messages: Message[]): Promise<string[]> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const images = (lastUser?.attachments ?? []).filter(
    (a) => a.type === 'image' && a.imageBase64,
  );
  const paths: string[] = [];
  for (const img of images) {
    const path = `${FileSystem.cacheDirectory}vision-${img.id}.jpg`;
    await FileSystem.writeAsStringAsync(path, img.imageBase64!, {
      encoding: FileSystem.EncodingType.Base64,
    });
    paths.push(path);
  }
  return paths;
}

export interface LoadOptions {
  /** Model's on-disk size in GB — enables the pre-load RAM check when provided. */
  modelSizeGb?: number;
  /** Skip the RAM check (used after the user picks "Load Anyway"). */
  bypassRamCheck?: boolean;
}

let context: LlamaContext | null = null;
let currentPath: string | null = null;
let cancelled = false;
let initPromise: Promise<void> | null = null;

/**
 * The single in-flight completion on the shared context, and what kind it is.
 *
 * llama.rn has one native context; issuing two `context.completion()` calls at
 * once crashes it ("Exception in HostFunction: <unknown>"). Everything that
 * runs a completion (chat replies + silent Second Brain extraction) goes
 * through this lock so only one ever runs at a time.
 */
let activeCompletion: Promise<void> | null = null;
let activeKind: 'chat' | 'extract' | null = null;

const N_CTX = 8192;
const STOP = ['<end_of_turn>', '<start_of_turn>'];

async function doInit(path: string): Promise<void> {
  try {
    context = await initLlama({
      model: path,
      n_ctx: N_CTX,
      // Larger batch markedly speeds prompt prefill (long research/vision
      // prompts) at a modest, bounded memory cost — the prior value of 32 was
      // a big bottleneck for research.
      n_batch: 128,
      n_threads: 4,
      n_gpu_layers: 0,
      use_mlock: false,
      use_mmap: true,
    });
    currentPath = path;
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (/memory|oom|out of mem|failed to allocate/.test(msg)) throw new Error('INSUFFICIENT_RAM');
    if (/no such file|not found|open failed|enoent/.test(msg)) throw new Error('MODEL_NOT_FOUND');
    throw new Error(`MODEL_LOAD_FAILED: ${msg}`);
  }
}

/**
 * Load a model. Concurrent calls await the same init (prevents the Beta-1 crash).
 *
 * When `opts.modelSizeGb` is given (and not bypassed) the device's available RAM
 * is checked first; an insufficient device throws `RAMInsufficientError` before
 * any native allocation happens.
 */
export function initLlm(modelPath: string, opts: LoadOptions = {}): Promise<void> {
  const path = modelPath.replace(/^file:\/\//, '');
  if (context && currentPath === path) return Promise.resolve();
  if (opts.modelSizeGb != null && !opts.bypassRamCheck) {
    assertRAMSufficient(opts.modelSizeGb);
  }
  if (initPromise) {
    return initPromise.then(() =>
      context && currentPath === path ? undefined : initLlm(path, opts),
    );
  }
  initPromise = (async () => {
    try {
      await releaseLlm();
      await doInit(path);
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

/** Stop any in-flight completion and wait for it to fully settle. */
async function drainActive(): Promise<void> {
  if (!activeCompletion) return;
  try { context?.stopCompletion(); } catch {}
  try { await activeCompletion; } catch {}
}

export async function generate(
  system: string,
  messages: Message[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): Promise<void> {
  if (!context) return onError('No model loaded.');

  const path = currentPath;
  const trimmed = trimToContext(messages, N_CTX);
  // Forward image attachments to the model only when a projector is loaded.
  // CRITICAL: do this writing BEFORE draining/locking. An `await` between
  // drainActive() and assigning `activeCompletion` opens a window where a
  // background extraction can start a second concurrent completion on the one
  // native context — which crashes it ("Exception in HostFunction: <unknown>").
  const mediaPaths = multimodalReady ? await writeImagePaths(trimmed) : [];
  // Build the prompt knowing whether the image is actually being delivered, so
  // the media marker is only emitted when pixels are truly sent.
  const prompt = buildGemmaPrompt(system, trimmed, mediaPaths.length > 0);

  // A live chat reply must never overlap a background extraction. Stop and
  // drain whatever is running first (extraction is best-effort and discardable).
  await drainActive();
  if (!context) return onError('No model loaded.');
  // Starting a fresh generation clears any prior cancellation.
  cancelled = false;
  activeKind = 'chat';
  const base: Record<string, unknown> = {
    prompt, n_predict: 1024, temperature: 0.7, top_p: 0.9, top_k: 40, penalty_repeat: 1.1, stop: STOP,
  };
  // Marker-free prompt for the text-only fallback (a leftover <__media__> in a
  // non-media completion would confuse the model).
  const textBase: Record<string, unknown> = mediaPaths.length
    ? { ...base, prompt: buildGemmaPrompt(system, trimmed, false) }
    : base;

  let emitted = 0;
  const onTok = (tr: { token?: string }) => {
    if (tr.token != null) { emitted++; onToken(tr.token); }
  };
  const isAbort = (m: string) => /abort|cancel|stop/i.test(m);

  // Rebuild a fresh native context after a hard crash so the NEXT message (and
  // a text-only retry) isn't stuck on a corrupted context. Releases directly —
  // never via drainActive(), which would await this very completion (deadlock).
  const reinit = async (): Promise<void> => {
    multimodalReady = false;
    try { await context?.release(); } catch {}
    context = null; currentPath = null;
    if (path) { try { await doInit(path); } catch {} }
  };

  activeCompletion = (async () => {
    try {
      const params = mediaPaths.length ? { ...base, media_paths: mediaPaths } : base;
      // media_paths is honored by multimodal-capable llama.rn builds.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await context!.completion(params as any, onTok);
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'generation failed';
      if (isAbort(msg)) { onDone(); return; }
      // A vision (media) completion can hard-crash the native context. Rebuild a
      // clean context and retry text-only so the user still gets a reply.
      if (mediaPaths.length && emitted === 0) {
        lastVisionError = `Image decode failed: ${msg}`;
        visionSelfTestPassed = false;
        await reinit();
        if (context) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await context.completion(textBase as any, onTok);
            onDone();
            return;
          } catch (err2) {
            const m2 = err2 instanceof Error ? err2.message : 'generation failed';
            if (isAbort(m2)) { onDone(); return; }
            await reinit();
            onError(m2);
            return;
          }
        }
      }
      // Plain crash: rebuild the context so the next message works.
      await reinit();
      onError(msg);
    } finally {
      activeCompletion = null; activeKind = null;
    }
  })();
}

/**
 * Abort the in-flight chat reply immediately. Sets a cancellation flag and asks
 * the llama.rn context to stop; the pending completion then resolves via its
 * abort path. The flag is cleared the next time `generate` is called.
 */
export function stop(): void {
  cancelled = true;
  try { context?.stopCompletion(); } catch {}
}

/**
 * Run a silent, one-shot completion and resolve the full generated text.
 *
 * Used by the Second Brain memory extractor — it reuses the already-loaded
 * context (no second model instance) and never streams to the chat UI. Returns
 * `null` when no model is loaded or any other completion is already in flight,
 * so extraction can never collide with a live chat reply.
 */
export async function extract(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; preempt?: boolean } = {},
): Promise<string | null> {
  if (!context) return null;
  // Research (preempt) stops any in-flight best-effort extraction first so it
  // never silently no-ops; background extraction instead yields if something
  // is already running (a chat reply always wins).
  if (opts.preempt) await drainActive();
  else if (activeCompletion) return null;
  if (!context) return null;

  let text = '';
  activeKind = 'extract';
  const run = context
    .completion(
      {
        prompt,
        n_predict: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.1,
        top_p: 0.9,
        stop: STOP,
      },
      (tr: { token?: string }) => { if (tr.token != null) text += tr.token; },
    )
    .then(() => {}, (err: unknown) => {
      text = '';
      const m = err instanceof Error ? err.message : '';
      // A chat reply preempting us (abort/stop) is expected — don't log it.
      if (!/abort|cancel|stop/i.test(m)) console.error('[LlamaService] extract', err);
    })
    .finally(() => { activeCompletion = null; activeKind = null; });
  activeCompletion = run;

  await run;
  return text.length ? text : null;
}

/** Whether the last chat generation was aborted by the user. */
export const wasCancelled = (): boolean => cancelled;

/** @deprecated use {@link stop}. */
export const stopGeneration = stop;

export async function releaseLlm(): Promise<void> {
  if (!context) return;
  await drainActive();
  try { await context.release(); } catch (e) { console.error('[LlamaService] release', e); }
  context = null; currentPath = null; activeCompletion = null; activeKind = null;
  multimodalReady = false;
  lastVisionError = null;
  visionSelfTestPassed = false;
}

export const isModelLoaded = (): boolean => context !== null;
export const isLoading = (): boolean => initPromise !== null;
export const getLoadedPath = (): string | null => currentPath;
/** True while a chat reply is streaming (not extraction). */
export const isGenerating = (): boolean => activeKind === 'chat';
