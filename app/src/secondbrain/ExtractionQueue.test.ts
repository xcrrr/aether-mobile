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
});
