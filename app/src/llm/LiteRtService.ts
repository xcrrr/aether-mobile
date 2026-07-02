import {
  NativeModules,
  NativeEventEmitter,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Message } from '@/types';
import { messageModelText } from '@/llm/messageParse';
import { assertRAMSufficient } from '@/utils/ramCheck';

export interface LoadOptions {
  modelSizeGb?: number;
  bypassRamCheck?: boolean;
}

/**
 * JS bridge over the native MediaPipe LiteRT GenAI engine (see
 * android/.../litert/LiteRtModule.kt): GPU-accelerated chat + real Gemma vision
 * via `.litertlm` models.
 *
 * One generation runs at a time: every entry point goes through `activeCompletion`
 * so a background Second-Brain extraction never overlaps a chat reply.
 */
interface LiteRtNativeModule extends TurboModule {
  init(path: string, maxTokens: number): Promise<string>;
  generate(
    systemPrompt: string, historyJson: string, lastText: string, imagePaths: string[],
    topK: number, topP: number, temperature: number, stream: boolean, maxOutputTokens: number,
  ): Promise<string>;
  stop(): Promise<boolean>;
  release(): Promise<boolean>;
  isLoaded(): Promise<boolean>;
  getLoadedPath(): Promise<string | null>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const LiteRt =
  (TurboModuleRegistry.get<LiteRtNativeModule>('LiteRt') ??
    NativeModules.LiteRt) as LiteRtNativeModule | undefined;

const emitter = LiteRt ? new NativeEventEmitter(LiteRt) : null;

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
let visionEnabled = false;
let gpuActive = false;

export async function initLlm(modelPath: string, opts: LoadOptions = {}): Promise<void> {
  if (!LiteRt) throw new Error('LiteRT engine not available in this build');
  const path = modelPath.replace(/^file:\/\//, '');
  if (currentPath === path) return;
  if (opts.modelSizeGb != null && !opts.bypassRamCheck) assertRAMSufficient(opts.modelSizeGb);
  try {
    const caps = await LiteRt.init(path, MAX_TOKENS);
    try {
      const parsed = JSON.parse(caps) as { gpu?: boolean; vision?: boolean };
      visionEnabled = !!parsed.vision;
      gpuActive = !!parsed.gpu;
    } catch { visionEnabled = false; gpuActive = false; }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const low = raw.toLowerCase();
    if (/memory|oom|out of mem|alloc/.test(low)) throw new Error('INSUFFICIENT_RAM');
    if (/not found|no such file|enoent|incomplete/.test(low)) throw new Error('MODEL_NOT_FOUND');
    // Surface the actual native reason instead of a generic message.
    throw new Error(raw || 'Could not load this model');
  }
  currentPath = path;
}

export const isVisionEnabled = (): boolean => visionEnabled;
export const isGpuActive = (): boolean => gpuActive;

export interface ConversationParts { system: string; historyJson: string; lastText: string; }

/**
 * Split a conversation into the pieces litertlm needs: the system instruction, the
 * prior turns (seeded as `initialMessages`), and the new user turn. litertlm applies
 * Gemma's own chat template, so we pass STRUCTURED turns, never a flattened
 * "User:/Assistant:" blob (that made the model invent turns and never stop).
 * Question turns go into history as natural language (messageModelText), never
 * as the raw JSON the model emitted.
 */
export function splitConversation(system: string, messages: Message[]): ConversationParts {
  let lastUserIdx = -1;
  for (let i = 0; i < messages.length; i++) if (messages[i].role === 'user') lastUserIdx = i;
  const history = (lastUserIdx >= 0 ? messages.slice(0, lastUserIdx) : messages)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: messageModelText(m).trim() }))
    .filter((t) => t.text);
  const lastText = lastUserIdx >= 0 ? messages[lastUserIdx].content.trim() : '';
  return { system: system.trim(), historyJson: JSON.stringify(history), lastText };
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
  // Guard against a native completion that never settles: don't wait forever, or a
  // single stuck generation would deadlock every future message.
  try {
    await Promise.race([
      activeCompletion,
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch {}
  activeCompletion = null;
  activeKind = null;
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
  const { system: sys, historyJson, lastText } = splitConversation(system, messages);
  await drainActive();
  cancelled = false;
  activeKind = 'chat';

  const sub = emitter.addListener('LiteRtToken', (piece: string) => onToken(piece));
  const run = LiteRt.generate(sys, historyJson, lastText, imagePaths, TOP_K, TOP_P, TEMPERATURE, true, 0)
    .then(() => onDone())
    .catch((e) => onError(e instanceof Error ? e.message : String(e)))
    .finally(() => { sub.remove(); activeCompletion = null; activeKind = null; });
  activeCompletion = run;
  await run;
}

/** Callers (Second Brain extractor, research) wrap prompts in Gemma `<start_of_turn>`
 *  scaffolding for historical prompt compatibility. LiteRT applies its own template, so strip the wrapper
 *  and pass the plain instruction as a single user turn. */
export function plainFromGemma(prompt: string): string {
  return prompt
    .replace(/<start_of_turn>(?:user|model)\n?/g, '')
    .replace(/<end_of_turn>\n?/g, '')
    .trim();
}

export async function extract(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; preempt?: boolean; onToken?: (t: string) => void } = {},
): Promise<string | null> {
  if (!LiteRt) return null;
  if (opts.preempt) await drainActive();
  else if (activeCompletion) return null;

  activeKind = 'extract';
  // Stream only when a token sink is given (research answer to live bubble). The
  // maxTokens cap is now enforced natively, so research no longer runs to the 4096
  // engine ceiling, the single biggest latency win.
  const stream = !!opts.onToken;
  const sub = stream && emitter ? emitter.addListener('LiteRtToken', (p: string) => opts.onToken!(p)) : null;
  const run = LiteRt.generate(
    '', '[]', plainFromGemma(prompt), [], TOP_K, TOP_P, opts.temperature ?? 0.1, stream, opts.maxTokens ?? 0,
  );
  activeCompletion = run.finally(() => { sub?.remove(); activeCompletion = null; activeKind = null; });
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
  visionEnabled = false;
  gpuActive = false;
}

export const isModelLoaded = (): boolean => currentPath !== null;
export const isBusy = (): boolean => activeCompletion !== null;
export const isGenerating = (): boolean => activeKind === 'chat';
export const wasCancelled = (): boolean => cancelled;
export const getLoadedPath = (): string | null => currentPath;
export const isLoading = (): boolean => false;
