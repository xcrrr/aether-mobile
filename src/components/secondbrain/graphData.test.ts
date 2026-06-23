import { toGraphData, CATEGORY_COLORS, shortLabel } from './graphData';
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
    expect(nodes[0]).toMatchObject({ id: 'city', label: 'v', category: 'identity', color: CATEGORY_COLORS.identity });
    expect(nodes[0].val).toBeGreaterThan(0);
  });
  it('truncates long node labels with an ellipsis (full value kept elsewhere)', () => {
    const { nodes } = toGraphData([entry({ key: 'bio', value: 'x'.repeat(60) })], []);
    expect(nodes[0].label.length).toBeLessThanOrEqual(24);
    expect(nodes[0].label.endsWith('…')).toBe(true);
  });
  it('shortLabel leaves short strings untouched', () => {
    expect(shortLabel('Warsaw')).toBe('Warsaw');
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
  it('flags nodes whose key is in recentKeys as recent', () => {
    const entries = [entry({ key: 'city' }), entry({ key: 'goal', id: 'i2' })];
    const { nodes } = toGraphData(entries, [], new Set(['goal']));
    expect(nodes.find((n) => n.id === 'city')!.recent).toBe(false);
    expect(nodes.find((n) => n.id === 'goal')!.recent).toBe(true);
  });
  it('defaults recent to false when no recentKeys given', () => {
    const { nodes } = toGraphData([entry({ key: 'city' })], []);
    expect(nodes[0].recent).toBe(false);
  });
  it('collapses entries that share a key into one node (force-graph needs unique ids)', () => {
    // Same key surfacing in two categories must not emit two nodes with the same id —
    // duplicate ids break the 3d-force-graph node map and the graph renders blank.
    const entries = [
      entry({ key: 'x', category: 'identity', id: 'a' }),
      entry({ key: 'x', category: 'goals', id: 'b' }),
    ];
    const { nodes } = toGraphData(entries, []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('x');
  });
  it('keeps a shared-key node marked recent when either duplicate is recent', () => {
    const entries = [
      entry({ key: 'x', category: 'identity', id: 'a' }),
      entry({ key: 'x', category: 'goals', id: 'b' }),
    ];
    const { nodes } = toGraphData(entries, [], new Set(['x']));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].recent).toBe(true);
  });
});
