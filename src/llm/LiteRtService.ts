import { NativeModules, NativeEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Message } from '@/types';
import { assertRAMSufficient } from '@/utils/ramCheck';

export interface LoadOptions {
  modelSizeGb?: number;
  bypassRamCheck?: boolean;
}

/**
 * JS bridge over the native MediaPipe LiteRT GenAI engine (see
 * android/.../litert/LiteRtModule.kt). Mirrors the surface of LlamaService so the
 * app can swap engines: GPU-accelerated chat + real Gemma vision via `.task` models.
 *
 * One generation runs at a time — every entry point goes through `activeCompletion`
 * so a background Second-Brain extraction never overlaps a chat reply.
 */
const LiteRt = NativeModules.LiteRt as {
  init(path: string, maxTokens: number): Promise<boolean>;
  generate(
    prompt: string, imagePaths: string[], topK: number, topP: number,
    temperature: number, stream: boolean,
  ): Promise<string>;
  stop(): Promise<boolean>;
  release(): Promise<boolean>;
  isLoaded(): Promise<boolean>;
  getLoadedPath(): Promise<string | null>;
} | undefined;

const emitter = LiteRt ? new NativeEventEmitter(NativeModules.LiteRt) : null;

export const isAvailable = (): boolean => !!LiteRt;

const MAX_TOKENS = 4096;
// Gemma's official sampling (matches Google's AI Edge Gallery).
const TOP_K = 64;
const TOP_P = 0.95;
const TEMPERATURE = 1.0;

let currentPath: string | null = null;
let activeCompletion: Promise<unknown> | null = null;
let activeKind: 'chat' | 'extract' | null = null;
let cancelled = false;

export async function initLlm(modelPath: string, opts: LoadOptions = {}): Promise<void> {
  if (!LiteRt) throw new Error('LiteRT engine unavailable');
  const path = modelPath.replace(/^file:\/\//, '');
  if (currentPath === path) return;
  if (opts.modelSizeGb != null && !opts.bypassRamCheck) assertRAMSufficient(opts.modelSizeGb);
  try {
    await LiteRt.init(path, MAX_TOKENS);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (/memory|oom|out of mem|alloc/.test(msg)) throw new Error('INSUFFICIENT_RAM');
    if (/not found|no such file|enoent/.test(msg)) throw new Error('MODEL_NOT_FOUND');
    throw new Error('MODEL_LOAD_FAILED');
  }
  currentPath = path;
}

/** Flatten a conversation into a plain transcript. MediaPipe wraps it in the
 *  model's own turn template, so we must NOT emit Gemma `<start_of_turn>` markers. */
export function buildPrompt(system: string, messages: Message[]): string {
  const parts: string[] = [];
  if (system.trim()) parts.push(system.trim());
  for (const m of messages) {
    const who = m.role === 'user' ? 'User' : 'Assistant';
    if (m.content.trim()) parts.push(`${who}: ${m.content.trim()}`);
  }
  parts.push('Assistant:');
  return parts.join('\n\n');
}

/** Persist the last user message's images to cache files for the native side. */
async function writeImagePaths(messages: Message[]): Promise<string[]> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const images = (lastUser?.attachments ?? []).filter((a) => a.type === 'image' && a.imageBase64);
  const paths: string[] = [];
  for (const img of images) {
    const uri = `${FileSystem.cacheDirectory}litert-${img.id}.jpg`;
    await FileSystem.writeAsStringAsync(uri, img.imageBase64!, { encoding: FileSystem.EncodingType.Base64 });
    paths.push(uri.replace(/^file:\/\//, ''));
  }
  return paths;
}

async function drainActive(): Promise<void> {
  if (!activeCompletion) return;
  try { await LiteRt?.stop(); } catch {}
  try { await activeCompletion; } catch {}
}

export async function generate(
  system: string,
  messages: Message[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): Promise<void> {
  if (!LiteRt || !emitter) return onError('LiteRT engine unavailable');
  const imagePaths = await writeImagePaths(messages);
  const prompt = buildPrompt(system, messages);
  await drainActive();
  cancelled = false;
  activeKind = 'chat';

  const sub = emitter.addListener('LiteRtToken', (piece: string) => onToken(piece));
  const run = LiteRt.generate(prompt, imagePaths, TOP_K, TOP_P, TEMPERATURE, true)
    .then(() => onDone())
    .catch((e) => onError(e instanceof Error ? e.message : String(e)))
    .finally(() => { sub.remove(); activeCompletion = null; activeKind = null; });
  activeCompletion = run;
  await run;
}

export async function extract(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; preempt?: boolean } = {},
): Promise<string | null> {
  if (!LiteRt) return null;
  if (opts.preempt) await drainActive();
  else if (activeCompletion) return null;

  activeKind = 'extract';
  const run = LiteRt.generate(prompt, [], TOP_K, TOP_P, opts.temperature ?? 0.1, false);
  activeCompletion = run.finally(() => { activeCompletion = null; activeKind = null; });
  try {
    const text = await run;
    return text && text.length ? text : null;
  } catch {
    return null;
  }
}

export function stop(): void { cancelled = true; void LiteRt?.stop(); }

export async function releaseLlm(): Promise<void> {
  await drainActive();
  try { await LiteRt?.release(); } catch {}
  currentPath = null;
  activeCompletion = null;
  activeKind = null;
}

export const isModelLoaded = (): boolean => currentPath !== null;
export const isBusy = (): boolean => activeCompletion !== null;
export const isGenerating = (): boolean => activeKind === 'chat';
export const wasCancelled = (): boolean => cancelled;
export const getLoadedPath = (): string | null => currentPath;
export const isLoading = (): boolean => false;
