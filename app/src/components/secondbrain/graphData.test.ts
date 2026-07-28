import {
  CATEGORY_COLORS,
  VISUAL_CATEGORY_COLORS,
  connectionExplanation,
  inferVisualCategory,
  shortLabel,
  toGraphData,
} from './graphData';
import { MemoryEntry, MemoryEdge } from '@/secondbrain/types';

const entry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  id: over.id ?? 'i',
  category: over.category ?? 'identity',
  key: over.key ?? 'k',
  value: over.value ?? 'v',
  confidence: over.confidence ?? 0.8,
  sourceConversationId: over.sourceConversationId ?? 'c',
  createdAt: 0,
  updatedAt: 0,
  lastSeenAt: 0,
  timesReinforced: 0,
  ...over,
});

describe('toGraphData', () => {
  it('maps entries to muted visual-category nodes without changing source category', () => {
    const { nodes } = toGraphData([entry({ key: 'aether_project', category: 'goals', confidence: 0.9 })], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: 'aether_project',
      sourceCategory: 'goals',
      category: 'projects',
      color: VISUAL_CATEGORY_COLORS.projects,
    });
    expect(CATEGORY_COLORS.goals).toBe(VISUAL_CATEGORY_COLORS.projects);
    expect(nodes[0].val).toBeGreaterThan(0);
  });

  it('uses a user-corrected visual category when present', () => {
    expect(inferVisualCategory(entry({ category: 'goals', visualCategory: 'health' }))).toBe('health');
  });

  it('truncates long node labels with an ascii ellipsis', () => {
    const { nodes } = toGraphData([entry({ key: 'bio', value: 'x'.repeat(60) })], []);
    expect(nodes[0].label.length).toBeLessThanOrEqual(24);
    expect(nodes[0].label.endsWith('...')).toBe(true);
  });

  it('shortLabel leaves short strings untouched', () => {
    expect(shortLabel('Warsaw')).toBe('Warsaw');
  });

  it('keeps explicit links whose endpoints both exist and adds an explanation', () => {
    const entries = [entry({ key: 'a' }), entry({ key: 'b', id: 'i2' })];
    const edges: MemoryEdge[] = [
      { id: 'e1', fromKey: 'a', toKey: 'b', relation: 'located_in' },
      { id: 'e2', fromKey: 'a', toKey: 'ghost', relation: 'r' },
    ];
    const { links } = toGraphData(entries, edges);
    const explicit = links.find((l) => l.relationshipType === 'explicit');
    expect(explicit).toMatchObject({ source: 'a', target: 'b', relation: 'located_in', relationshipStrength: 1 });
    expect(explicit?.explanation).toContain('located in');
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

  it('keeps both entries when two categories share a key, without duplicate node ids', () => {
    const entries = [
      entry({ key: 'x', category: 'identity', id: 'a' }),
      entry({ key: 'x', category: 'goals', id: 'b' }),
    ];
    const { nodes } = toGraphData(entries, []);
    expect(nodes).toHaveLength(2);
    expect(nodes.some((n) => n.id === 'x')).toBe(true);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(2);
    expect(new Set(nodes.map((n) => n.entryId))).toEqual(new Set(['a', 'b']));
  });

  it('adds grounded discussed-together links for memories saved from the same conversation', () => {
    const entries = [
      entry({ key: 'a', sourceConversationId: 'chat-1' }),
      entry({ key: 'b', id: 'b-id', sourceConversationId: 'chat-1' }),
    ];
    const { links } = toGraphData(entries, []);
    expect(links.some((l) => l.relationshipType === 'discussed_together')).toBe(true);
  });

  it('computes connection counts after explicit and derived links', () => {
    const entries = [entry({ key: 'a' }), entry({ key: 'b', id: 'b-id' })];
    const { nodes } = toGraphData(entries, [{ id: 'e', fromKey: 'a', toKey: 'b', relation: 'related_to' }]);
    expect(nodes.every((n) => n.connectionCount > 0)).toBe(true);
    expect(nodes.every((n) => n.centralityScore > 0)).toBe(true);
  });

  it('keeps graph nodes point-like instead of large hub balls', () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry({
      id: `id-${i}`,
      key: `aether_project_${i}`,
      value: `Aether project local first design memory ${i}`,
      category: i % 2 === 0 ? 'goals' : 'knowledge',
      confidence: 0.9,
      timesReinforced: i % 4,
    }));
    const { nodes } = toGraphData(entries, []);
    expect(Math.max(...nodes.map((n) => n.val))).toBeLessThanOrEqual(2.35);
    expect(Math.min(...nodes.map((n) => n.val))).toBeGreaterThanOrEqual(0.58);
  });

  it('seeds positions into a compact real 3d volume that scales with count', () => {
    const make = (count: number) => Array.from({ length: count }, (_, i) => entry({
      id: `id-${i}`,
      key: `memory_${i}`,
      value: `context bridge project person learning travel memory ${i}`,
      category: i % 3 === 0 ? 'goals' : i % 3 === 1 ? 'relationships' : 'knowledge',
    }));
    const small = toGraphData(make(18), []);
    const maxAxis = Math.max(...small.nodes.flatMap((n) => [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]));
    const zSpread = Math.max(...small.nodes.map((n) => n.z)) - Math.min(...small.nodes.map((n) => n.z));
    expect(maxAxis).toBeLessThan(small.layout.radius * 1.1);
    expect(zSpread).toBeGreaterThan(8);
    const big = toGraphData(make(200), []);
    expect(big.layout.radius).toBeGreaterThan(small.layout.radius);
    expect(big.layout.radius).toBeLessThan(small.layout.radius * 3);
  });

  it('keeps a tiny graph compact instead of scattering it', () => {
    const entries = [
      entry({ key: 'a', value: 'runs a barber shop in Warsaw', sourceConversationId: 'c1' }),
      entry({ key: 'b', id: 'i2', value: 'wants to grow on Instagram', category: 'goals', sourceConversationId: 'c2' }),
      entry({ key: 'c', id: 'i3', value: 'sister lives in Krakow', category: 'relationships', sourceConversationId: 'c3' }),
    ];
    const { nodes, layout } = toGraphData(entries, []);
    expect(layout.radius).toBeLessThan(16);
    for (const n of nodes) {
      expect(Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)).toBeLessThan(layout.radius * 1.1);
    }
  });

  it('never produces NaN or Infinity positions', () => {
    const entries = Array.from({ length: 40 }, (_, i) => entry({
      id: `n-${i}`, key: `key_${i}`, value: `fact number ${i}`,
      category: (['identity', 'goals', 'knowledge', 'relationships'] as const)[i % 4],
    }));
    const { nodes, layout } = toGraphData(entries, []);
    for (const n of nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)).toBe(true);
    }
    expect(Number.isFinite(layout.radius)).toBe(true);
    for (const c of Object.values(layout.clusterCenters)) {
      expect(c!.every(Number.isFinite)).toBe(true);
    }
  });

  it('is deterministic: the same data always lays out identically', () => {
    const entries = Array.from({ length: 9 }, (_, i) => entry({
      id: `d-${i}`, key: `det_${i}`, value: `deterministic memory ${i}`,
      category: i % 2 === 0 ? 'goals' : 'knowledge',
    }));
    const a = toGraphData(entries, []);
    const b = toGraphData(entries, []);
    expect(a.nodes.map((n) => [n.id, n.x, n.y, n.z])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y, n.z]));
    expect(a.links.map((l) => l.id)).toEqual(b.links.map((l) => l.id));
  });

  it('creates only real, explainable link types — never index or category filler', () => {
    const entries = Array.from({ length: 16 }, (_, i) => entry({
      id: `mesh-${i}`,
      key: `mesh_${i}`,
      value: `${i % 2 === 0 ? 'Aether' : 'Android'} local first design project bridge ${i}`,
      category: i % 4 === 0 ? 'goals' : i % 4 === 1 ? 'knowledge' : i % 4 === 2 ? 'relationships' : 'context',
      sourceConversationId: i < 10 ? 'shared-chat' : `chat-${i % 3}`,
      confidence: 0.84,
    }));
    const { links } = toGraphData(entries, [{ id: 'e', fromKey: 'mesh_0', toKey: 'mesh_1', relation: 'related_to' }]);
    expect(links.length).toBeGreaterThan(0);
    const types = new Set(links.map((l) => l.relationshipType));
    for (const t of types) expect(['explicit', 'discussed_together', 'shared_topic', 'same_cluster']).toContain(t);
    expect(links.every((link) => link.explanation.length > 0)).toBe(true);
  });

  it('links memories that share a meaningful word, naming the word', () => {
    const entries = [
      entry({ key: 'shop', value: 'runs the Mitruk barber shop', sourceConversationId: 'c1' }),
      entry({ key: 'goal', id: 'i2', value: 'grow the Mitruk brand online', category: 'goals', sourceConversationId: 'c2' }),
      entry({ key: 'pet', id: 'i3', value: 'has a golden retriever', category: 'preferences', sourceConversationId: 'c3' }),
    ];
    const { links } = toGraphData(entries, []);
    const topic = links.filter((l) => l.relationshipType === 'shared_topic');
    expect(topic).toHaveLength(1);
    expect(topic[0].explanation).toContain('mitruk');
    expect(topic[0].relationshipStrength).toBeLessThan(0.55);
  });

  it('does not build keyword hubs from corpus-generic words', () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry({
      id: `g-${i}`, key: `generic_${i}`,
      value: `enjoys aether things ${i}`,
      sourceConversationId: `chat-${i}`,
    }));
    const { links } = toGraphData(entries, []);
    // "aether" appears in every memory — too generic here to mean anything.
    expect(links.filter((l) => l.relationshipType === 'shared_topic')).toHaveLength(0);
  });

  it('caps shared-topic links per node and never duplicates a pair', () => {
    const words = ['alpha', 'bravo', 'carlo', 'delta', 'echos'];
    const hub = entry({ id: 'hub', key: 'hub_memory', value: words.join(' '), sourceConversationId: 'c-hub' });
    const spokes = words.map((w, i) => entry({
      id: `spoke-${i}`, key: `spoke_${i}`, value: `has ${w}`, sourceConversationId: `c-${i}`,
    }));
    const { links } = toGraphData([hub, ...spokes], []);
    const topic = links.filter((l) => l.relationshipType === 'shared_topic');
    // 5 candidate pairs all touch the hub node → capped at 3.
    expect(topic).toHaveLength(3);
    const pairs = new Set<string>();
    for (const l of topic) {
      const key = l.source < l.target ? `${l.source}|${l.target}` : `${l.target}|${l.source}`;
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
  });

  it('shared-topic never overrides a stronger existing relationship', () => {
    const entries = [
      entry({ key: 'a', value: 'the Warsaw studio', sourceConversationId: 'c1' }),
      entry({ key: 'b', id: 'i2', value: 'moving to Warsaw soon', category: 'goals', sourceConversationId: 'c1' }),
    ];
    const { links } = toGraphData(entries, []);
    // Same pair qualifies for discussed_together AND shared_topic → one link only.
    expect(links).toHaveLength(1);
    expect(links[0].relationshipType).toBe('discussed_together');
  });

  it('same-conversation grouping is a single star, not a fabricated mesh', () => {
    const entries = Array.from({ length: 6 }, (_, i) => entry({
      id: `s-${i}`, key: `star_${i}`, sourceConversationId: 'one-chat',
    }));
    const { links } = toGraphData(entries, []);
    // 6 memories from one conversation → exactly 5 star links, no chains/bridges.
    expect(links).toHaveLength(5);
    expect(links.every((l) => l.relationshipType === 'discussed_together')).toBe(true);
  });

  it('manual memories get no derived conversation links, only cluster spanning', () => {
    const entries = [
      entry({ key: 'm1', sourceConversationId: 'manual' }),
      entry({ key: 'm2', id: 'i2', sourceConversationId: 'manual' }),
    ];
    const { links } = toGraphData(entries, []);
    expect(links.some((l) => l.relationshipType === 'discussed_together')).toBe(false);
    expect(links).toHaveLength(1);
    expect(links[0].relationshipType).toBe('same_cluster');
  });

  it('spanning links make every category cluster one connected component', () => {
    const entries = Array.from({ length: 10 }, (_, i) => entry({
      id: `cc-${i}`, key: `island_${i}`, value: `unrelated fact number${i}`,
      category: i % 2 === 0 ? 'goals' : 'relationships',
      sourceConversationId: `chat-${i}`,
    }));
    const { nodes, links } = toGraphData(entries, []);
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x) ?? x;
      if (p === x) return x;
      const r = find(p);
      parent.set(x, r);
      return r;
    };
    for (const l of links) parent.set(find(l.source), find(l.target));
    for (const cat of ['projects', 'people'] as const) {
      const group = nodes.filter((n) => n.category === cat);
      const roots = new Set(group.map((n) => find(n.id)));
      expect(roots.size).toBe(1);
    }
  });

  it('a deleted memory leaves no links behind', () => {
    const entries = [
      entry({ key: 'a', sourceConversationId: 'chat-1' }),
      entry({ key: 'b', id: 'i2', sourceConversationId: 'chat-1' }),
    ];
    const withBoth = toGraphData(entries, [{ id: 'e', fromKey: 'a', toKey: 'b', relation: 'related_to' }]);
    expect(withBoth.links.length).toBeGreaterThan(0);
    const afterDelete = toGraphData([entries[0]], [{ id: 'e', fromKey: 'a', toKey: 'b', relation: 'related_to' }]);
    expect(afterDelete.links).toHaveLength(0);
  });

  it('explains fallback relationships from link data or shared context', () => {
    const { nodes, links } = toGraphData(
      [entry({ key: 'a', value: 'Aether project' }), entry({ key: 'b', id: 'b-id', value: 'Aether launch' })],
      [],
    );
    expect(connectionExplanation(nodes[0], nodes[1], links[0])).toContain('Connected');
  });
});
