/**
 * Guards the Beta-2 crash: a chat reply and a Second Brain extraction must never
 * run a `context.completion()` at the same time on the single llama.rn context
 * (concurrent completions throw "Exception in HostFunction: <unknown>").
 */
import { Message } from '@/types';

const flush = () => new Promise((r) => setImmediate(r));

interface Pending { resolve: () => void; reject: (e: Error) => void; onToken: (t: { token?: string }) => void; }

let pendings: Pending[] = [];
let active = 0;
let maxConcurrent = 0;

const mockContext = {
  completion: jest.fn((_params: unknown, onToken: (t: { token?: string }) => void) => {
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    return new Promise<object>((resolve, reject) => {
      pendings.push({
        resolve: () => { active -= 1; resolve({}); },
        reject: (e: Error) => { active -= 1; reject(e); },
        onToken,
      });
    });
  }),
  stopCompletion: jest.fn(() => {
    const p = pendings.shift();
    if (p) p.reject(new Error('stopped'));
  }),
  release: jest.fn(() => Promise.resolve()),
};

jest.mock('llama.rn', () => ({ initLlama: jest.fn(async () => mockContext) }));
jest.mock('react-native-device-info', () => ({
  getTotalMemorySync: () => 16 * 1024 ** 3,
  getUsedMemorySync: () => 1 * 1024 ** 3,
}));

import * as Llama from './LlamaService';

const msg = (content: string): Message => ({ id: content, role: 'user', content, createdAt: 0 });

beforeEach(async () => {
  pendings = [];
  active = 0;
  maxConcurrent = 0;
  mockContext.completion.mockClear();
  await Llama.initLlm('/fake/model.gguf');
});

afterEach(async () => {
  // Drain anything left so state doesn't leak between tests.
  pendings.forEach((p) => p.resolve());
  await Llama.releaseLlm();
});

it('extract() yields (returns null) while a chat reply is generating', async () => {
  let done = false;
  let errored: string | null = null;
  await Llama.generate('sys', [msg('hi')], () => {}, () => { done = true; }, (e) => { errored = e; });

  // A chat completion is now in flight — extraction must refuse.
  const result = await Llama.extract('extract prompt');
  expect(result).toBeNull();
  expect(mockContext.completion).toHaveBeenCalledTimes(1); // extraction never issued

  pendings[0].resolve();
  await flush();
  expect(done).toBe(true);
  expect(errored).toBeNull();
});

it('a new chat reply preempts an in-flight extraction without overlapping', async () => {
  // Kick off a background extraction (do not await — it stays in flight).
  const extractPromise = Llama.extract('extract prompt');
  await flush();
  expect(active).toBe(1);

  // User sends a message mid-extraction → generate must stop+drain it first.
  let errored: string | null = null;
  await Llama.generate('sys', [msg('hi')], () => {}, () => {}, (e) => { errored = e; });

  // Extraction was stopped; only the chat completion is active now.
  expect(maxConcurrent).toBe(1);
  expect(await extractPromise).toBeNull();
  expect(errored).toBeNull();

  pendings.forEach((p) => p.resolve());
  await flush();
});
