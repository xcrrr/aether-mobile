import { forceLayout } from './forceLayout';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('forceLayout', () => {
  it('returns no positions for an empty graph', () => {
    expect(forceLayout([], []).size).toBe(0);
  });

  it('places a lone node at the origin', () => {
    const p = forceLayout([{ id: 'solo' }], []);
    expect(p.get('solo')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('gives every node a finite position', () => {
    const p = forceLayout(ids(20), [{ source: 'n0', target: 'n1' }]);
    expect(p.size).toBe(20);
    for (const v of p.values()) {
      expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
    }
  });

  it('is deterministic (same input → same layout)', () => {
    const links = [{ source: 'n0', target: 'n3' }, { source: 'n1', target: 'n2' }];
    const a = forceLayout(ids(8), links);
    const b = forceLayout(ids(8), links);
    for (const id of a.keys()) expect(b.get(id)).toEqual(a.get(id));
  });

  it('pulls linked nodes closer than unlinked ones', () => {
    // a–b linked; c only repelled → c should sit farther from a than b does.
    const p = forceLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [{ source: 'a', target: 'b' }],
    );
    const ab = dist(p.get('a')!, p.get('b')!);
    const ac = dist(p.get('a')!, p.get('c')!);
    expect(ab).toBeLessThan(ac);
  });

  it('keeps the cluster centred near the origin (centroid ≈ 0)', () => {
    const p = forceLayout(ids(30), []);
    let cx = 0, cy = 0, cz = 0;
    for (const v of p.values()) { cx += v.x; cy += v.y; cz += v.z; }
    const n = p.size;
    expect(Math.hypot(cx / n, cy / n, cz / n)).toBeLessThan(1e-6);
  });

  it('ignores links that reference missing nodes', () => {
    const p = forceLayout(ids(3), [{ source: 'n0', target: 'ghost' }]);
    expect(p.size).toBe(3);
    for (const v of p.values()) expect(Number.isFinite(v.x)).toBe(true);
  });
});
