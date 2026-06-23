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
});
