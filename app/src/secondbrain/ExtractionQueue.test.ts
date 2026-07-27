import { ExtractionQueue } from './ExtractionQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryStore, useMemoryStore } from './MemoryStore';

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
    await new Promise((r) => setTimeout(r, 120));
    expect(runs.filter((r) => r === 'c1').length).toBeGreaterThanOrEqual(2);
    q.stop();
  });

  it('reports the learned-fact count via onResult after a successful drain', async () => {
    const results: Array<[string, number]> = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      extract: async () => 3,
      onResult: (id, count) => results.push([id, count]),
      pollMs: 5,
    });
    q.markDirty('c1');
    await new Promise((r) => setTimeout(r, 20));
    expect(results).toEqual([['c1', 3]]);
    q.stop();
  });

  it('does not call onResult when extraction throws', async () => {
    let fail = true;
    const results: number[] = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      extract: async () => { if (fail) { fail = false; throw new Error('x'); } return 0; },
      onResult: (_id, count) => results.push(count),
      pollMs: 5,
    });
    q.markDirty('c1');
    await new Promise((r) => setTimeout(r, 120));
    expect(results).toEqual([0]); // only the successful retry reported
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

  it('does not retroactively extract a reply completed while Core was disabled', async () => {
    let coreEnabled = false;
    let busy = true;
    const runs: string[] = [];
    const results: Array<[string, number]> = [];
    const q = new ExtractionQueue({
      isBusy: () => busy,
      canQueue: () => coreEnabled,
      extract: async (id) => { runs.push(id); return 1; },
      onResult: (id, count) => results.push([id, count]),
      pollMs: 5,
    });

    // This reply belongs to the Core-off period. Enabling Core later must not
    // turn it into queued consent for inference or a stale saved-note notice.
    q.markDirty('disabled-conversation');
    coreEnabled = true;
    busy = false;
    await new Promise((r) => setTimeout(r, 20));

    expect(runs).toEqual([]);
    expect(results).toEqual([]);

    // A subsequent reply completed while enabled remains eligible as normal.
    q.markDirty('enabled-conversation');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual(['enabled-conversation']);
    expect(results).toEqual([['enabled-conversation', 1]]);
    q.stop();
  });

  it('invalidates pending extraction across a Core disable and re-enable cycle', async () => {
    let coreEnabled = true;
    let consentVersion = 0;
    let busy = true;
    const runs: string[] = [];
    const results: Array<[string, number]> = [];
    const q = new ExtractionQueue({
      isBusy: () => busy,
      canQueue: () => coreEnabled,
      queueToken: () => consentVersion,
      extract: async (id) => { runs.push(id); return 1; },
      onResult: (id, count) => results.push([id, count]),
      pollMs: 5,
    });

    q.markDirty('before-opt-out');
    coreEnabled = false;
    consentVersion += 1;
    coreEnabled = true;
    consentVersion += 1;
    busy = false;
    await new Promise((r) => setTimeout(r, 20));

    expect(runs).toEqual([]);
    expect(results).toEqual([]);

    q.markDirty('after-opt-in');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual(['after-opt-in']);
    expect(results).toEqual([['after-opt-in', 1]]);
    q.stop();
  });

  it('preserves newly consented work when an older extraction is preempted', async () => {
    let coreEnabled = true;
    let consentVersion = 0;
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    const runs: Array<[string, number]> = [];
    const results: Array<[string, number]> = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      canQueue: () => coreEnabled,
      queueToken: () => consentVersion,
      extract: async (id, queuedToken) => {
        runs.push([id, queuedToken as number]);
        if (runs.length === 1) {
          await new Promise<never>((_resolve, reject) => { rejectFirst = reject; });
        }
        return 1;
      },
      onResult: (id, count) => results.push([id, count]),
      pollMs: 5,
    });

    q.markDirty('same-conversation');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual([['same-conversation', 0]]);

    coreEnabled = false;
    consentVersion += 1;
    coreEnabled = true;
    consentVersion += 1;
    q.markDirty('same-conversation');
    rejectFirst?.(new Error('preempted by chat'));
    await new Promise((r) => setTimeout(r, 40));

    expect(runs).toEqual([
      ['same-conversation', 0],
      ['same-conversation', 2],
    ]);
    expect(results).toEqual([['same-conversation', 1]]);
    q.stop();
  });

  it('does not report a delayed success after Core is disabled and re-enabled', async () => {
    let coreEnabled = true;
    let consentVersion = 0;
    let resolveFirst: ((count: number) => void) | undefined;
    const runs: Array<[string, number]> = [];
    const results: Array<[string, number]> = [];
    const q = new ExtractionQueue({
      isBusy: () => false,
      canQueue: () => coreEnabled,
      queueToken: () => consentVersion,
      extract: async (id, queuedToken) => {
        runs.push([id, queuedToken as number]);
        if (runs.length === 1) {
          return new Promise<number>((resolve) => { resolveFirst = resolve; });
        }
        return 1;
      },
      onResult: (id, count) => results.push([id, count]),
      pollMs: 5,
    });

    q.markDirty('same-conversation');
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toEqual([['same-conversation', 0]]);

    coreEnabled = false;
    consentVersion += 1;
    coreEnabled = true;
    consentVersion += 1;
    q.markDirty('same-conversation');
    resolveFirst?.(1);
    await new Promise((r) => setTimeout(r, 40));

    expect(runs).toEqual([
      ['same-conversation', 0],
      ['same-conversation', 2],
    ]);
    expect(results).toEqual([['same-conversation', 1]]);
    q.stop();
  });

  it('invalidates queued automatic work when Core rehydrates across a cold restart', async () => {
    useMemoryStore.setState({
      memory: {
        userId: 'before-restart',
        entries: [],
        edges: [],
        deletions: [],
        lastExtractionAt: 0,
        totalConversationsAnalyzed: 0,
      },
      enabled: true,
      recentKeys: [],
    });
    const persisted = JSON.stringify({
      state: {
        memory: useMemoryStore.getState().memory,
        enabled: true,
      },
      version: 0,
    });
    const oldToken = MemoryStore.extractionConsentToken();
    let busy = true;
    const runs: Array<[string, unknown]> = [];
    const q = new ExtractionQueue({
      isBusy: () => busy,
      canQueue: MemoryStore.isEnabled,
      queueToken: MemoryStore.extractionConsentToken,
      extract: async (id, token) => {
        runs.push([id, token]);
        return 1;
      },
      pollMs: 5,
    });

    q.markDirty('before-restart');
    await AsyncStorage.setItem('aether_second_brain', persisted);
    await useMemoryStore.persist.rehydrate();
    expect(MemoryStore.extractionConsentToken()).not.toBe(oldToken);

    busy = false;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runs).toEqual([]);

    q.markDirty('after-restart');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runs).toEqual([['after-restart', MemoryStore.extractionConsentToken()]]);
    q.stop();
  });
});
