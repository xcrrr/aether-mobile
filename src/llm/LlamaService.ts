import { initLlama, type LlamaContext } from 'llama.rn';
import { Message } from '@/types';
import { buildGemmaPrompt, trimToContext } from './prompt';

let context: LlamaContext | null = null;
let currentPath: string | null = null;
let generating = false;
let completion: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

const N_CTX = 2048;
const STOP = ['<end_of_turn>', '<start_of_turn>'];

async function doInit(path: string): Promise<void> {
  try {
    context = await initLlama({
      model: path,
      n_ctx: N_CTX,
      n_batch: 32,
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

/** Load a model. Concurrent calls await the same init (prevents the Beta-1 crash). */
export function initLlm(modelPath: string): Promise<void> {
  const path = modelPath.replace(/^file:\/\//, '');
  if (context && currentPath === path) return Promise.resolve();
  if (initPromise) {
    return initPromise.then(() =>
      context && currentPath === path ? undefined : initLlm(path),
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

export async function generate(
  system: string,
  messages: Message[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): Promise<void> {
  if (!context) return onError('No model loaded.');
  const prompt = buildGemmaPrompt(system, trimToContext(messages, N_CTX));
  generating = true;
  completion = context
    .completion(
      { prompt, n_predict: 1024, temperature: 0.7, top_p: 0.9, top_k: 40, penalty_repeat: 1.1, stop: STOP },
      (tr: { token?: string }) => { if (tr.token != null) onToken(tr.token); },
    )
    .then(() => { generating = false; completion = null; onDone(); })
    .catch((err: unknown) => {
      generating = false; completion = null;
      const msg = err instanceof Error ? err.message : 'generation failed';
      if (/abort|cancel|stop/i.test(msg)) onDone(); else onError(msg);
    });
}

export function stopGeneration(): void {
  try { context?.stopCompletion(); } catch {}
  generating = false;
}

export async function releaseLlm(): Promise<void> {
  if (!context) return;
  if (generating) {
    stopGeneration();
    if (completion) { try { await completion; } catch {} }
  }
  try { await context.release(); } catch (e) { console.error('[LlamaService] release', e); }
  context = null; currentPath = null; generating = false; completion = null;
}

export const isModelLoaded = (): boolean => context !== null;
export const isLoading = (): boolean => initPromise !== null;
export const getLoadedPath = (): string | null => currentPath;
