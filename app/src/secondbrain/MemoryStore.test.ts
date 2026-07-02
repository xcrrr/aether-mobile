import { useMemoryStore, MemoryStore, dedupeEntries } from './MemoryStore';
import { MemoryEntry } from './types';

const mkEntry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  id: over.id ?? 'i', category: over.category ?? 'identity', key: over.key ?? 'k',
  value: over.value ?? 'v', confidence: over.confidence ?? 0.8, sourceConversationId: 'c',
  createdAt: 0, updatedAt: 0, lastSeenAt: 0, timesReinforced: 0, ...over,
});

function reset() {
  useMemoryStore.setState({
    memory: { userId: 'test-user', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
    enabled: true,
  });
}

beforeEach(reset);

describe('MemoryStore', () => {
  it('inserts a new entry with id and timestamps', () => {
    MemoryStore.addOrUpdateEntry({
      category: 'identity', key: 'preferred_name', value: 'Adam', confidence: 0.9, sourceConversationId: 'c1',
    });
    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBeTruthy();
    expect(all[0].timesReinforced).toBe(0);
    expect(all[0].createdAt).toBeGreaterThan(0);
  });

  it('a changed value keeps the old one in history and does not inherit confidence', () => {
    const base = { category: 'identity' as const, key: 'preferred_name', sourceConversationId: 'c1' };
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Adam', confidence: 0.95 });
    const created = MemoryStore.getAllEntries()[0];
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Adam P', confidence: 0.8 });

    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].value).toBe('Adam P');
    expect(all[0].confidence).toBe(0.8);         // new observation earns its own confidence
    expect(all[0].timesReinforced).toBe(0);      // reset: the new value is unconfirmed
    expect(all[0].history?.[0]?.value).toBe('Adam'); // old value preserved, not erased
  });

  it('re-observing the same value reinforces without inflating confidence', () => {
    const base = { category: 'identity' as const, key: 'city', sourceConversationId: 'c1' };
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Warsaw', confidence: 0.8 });
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Warsaw', confidence: 0.9 });
    const e = MemoryStore.getAllEntries()[0];
    expect(e.timesReinforced).toBe(1);
    expect(e.confidence).toBe(0.9); // max of observations, no +0.05 creep
    expect(e.history).toBeUndefined();
  });

  it('caps history at 5 revisions, newest first', () => {
    const base = { category: 'goals' as const, key: 'goal', sourceConversationId: 'c1' };
    for (let i = 0; i <= 7; i += 1) {
      MemoryStore.addOrUpdateEntry({ ...base, value: `goal v${i}`, confidence: 0.9 });
    }
    const e = MemoryStore.getAllEntries()[0];
    expect(e.value).toBe('goal v7');
    expect(e.history).toHaveLength(5);
    expect(e.history![0].value).toBe('goal v6');
  });

  it('stores evidence and reason when provided', () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'hobby', value: 'climbing', confidence: 0.9,
      sourceConversationId: 'c1', evidence: 'i love climbing', reason: 'You expressed this preference yourself',
    });
    const e = MemoryStore.getAllEntries()[0];
    expect(e.evidence).toBe('i love climbing');
    expect(e.reason).toBe('You expressed this preference yourself');
  });

  it('treats same key in a different category as distinct', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'x', value: 'a', confidence: 1, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'x', value: 'b', confidence: 1, sourceConversationId: 'c1' });
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
  });

  it('merges a re-keyed duplicate value within a category instead of saving it twice', () => {
    // The model often re-emits the same fact under a different key on a later
    // extraction. Same category + same (normalised) value = the same fact.
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'name', value: 'Adam', confidence: 0.8, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'preferred_name', value: 'adam.', confidence: 0.9, sourceConversationId: 'c2' });
    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe('name');           // original key is kept
    expect(all[0].timesReinforced).toBe(1);     // counted as a reinforcement
  });

  it('does not merge identical values across different categories', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'k1', value: 'Warsaw', confidence: 1, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'context', key: 'k2', value: 'Warsaw', confidence: 1, sourceConversationId: 'c1' });
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
  });

  it('filters by category', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'a', value: '1', confidence: 1, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'b', value: '2', confidence: 1, sourceConversationId: 'c1' });
    expect(MemoryStore.getEntriesByCategory('goals').map((e) => e.key)).toEqual(['b']);
  });

  it('deletes by id and clears all', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'a', value: '1', confidence: 1, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'b', value: '2', confidence: 1, sourceConversationId: 'c1' });
    const id = MemoryStore.getAllEntries()[0].id;
    MemoryStore.deleteEntry(id);
    expect(MemoryStore.getAllEntries()).toHaveLength(1);
    MemoryStore.clearAll();
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('toggles enabled and records extraction stats', () => {
    MemoryStore.setEnabled(false);
    expect(MemoryStore.isEnabled()).toBe(false);
    MemoryStore.recordExtraction();
    const { memory } = useMemoryStore.getState();
    expect(memory.totalConversationsAnalyzed).toBe(1);
    expect(memory.lastExtractionAt).toBeGreaterThan(0);
  });
});

describe('dedupeEntries', () => {
  it('collapses same-category duplicate values, keeping the strongest and folding counts', () => {
    const out = dedupeEntries([
      mkEntry({ id: 'a', category: 'identity', key: 'name', value: 'Adam', confidence: 0.7, timesReinforced: 0 }),
      mkEntry({ id: 'b', category: 'identity', key: 'preferred_name', value: 'adam.', confidence: 0.95, timesReinforced: 2 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('preferred_name'); // stronger copy wins
    expect(out[0].confidence).toBe(0.95);
    expect(out[0].timesReinforced).toBe(3);    // 0 + 2 + 1 merge
  });
  it('leaves distinct facts and cross-category matches untouched', () => {
    const out = dedupeEntries([
      mkEntry({ id: 'a', category: 'identity', value: 'Warsaw' }),
      mkEntry({ id: 'b', category: 'context', value: 'Warsaw' }),
      mkEntry({ id: 'c', category: 'identity', value: 'Adam' }),
    ]);
    expect(out).toHaveLength(3);
  });
});

describe('MemoryStore edges + reinforcement + decay', () => {
  beforeEach(() => {
    useMemoryStore.setState({
      memory: { userId: 'u', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true, hydrated: true,
    });
  });

  it('reinforcing an existing key bumps timesReinforced, confidence and lastSeenAt', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.6, sourceConversationId: 'c1' });
    const t0 = useMemoryStore.getState().memory.entries[0].lastSeenAt;
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.8, sourceConversationId: 'c2' });
    const e = useMemoryStore.getState().memory.entries[0];
    expect(e.timesReinforced).toBe(1);
    expect(e.confidence).toBeGreaterThanOrEqual(0.8);
    expect(e.lastSeenAt).toBeGreaterThanOrEqual(t0);
    expect(useMemoryStore.getState().memory.entries).toHaveLength(1);
  });

  it('addEdge dedupes identical from→to→relation', () => {
    const s = useMemoryStore.getState();
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    expect(useMemoryStore.getState().memory.edges).toHaveLength(1);
  });

  it('deleting an entry removes its dangling edges', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.6, sourceConversationId: 'c1' });
    s.addEdge({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
    const id = useMemoryStore.getState().memory.entries[0].id;
    s.deleteEntry(id);
    expect(useMemoryStore.getState().memory.edges).toHaveLength(0);
  });

  it('markStale flags single-observation entries unseen past the window', () => {
    const old = Date.now() - 1000 * 60 * 60 * 24 * 120; // 120 days ago
    useMemoryStore.setState((st) => ({
      memory: { ...st.memory, entries: [{
        id: 'e1', category: 'context', key: 'k', value: 'v', confidence: 0.8,
        sourceConversationId: 'c', createdAt: old, updatedAt: old, timesReinforced: 0, lastSeenAt: old,
      }, {
        id: 'e2', category: 'context', key: 'k2', value: 'v2', confidence: 0.8,
        sourceConversationId: 'c', createdAt: old, updatedAt: old, timesReinforced: 2, lastSeenAt: old,
      }] },
    }));
    useMemoryStore.getState().markStale();
    const entries = useMemoryStore.getState().memory.entries;
    expect(entries[0].stale).toBe(true);       // never confirmed, long unseen
    expect(entries[1].stale).toBeUndefined();  // reinforced facts don't decay
  });
});

describe('MemoryStore curation', () => {
  beforeEach(() => {
    useMemoryStore.setState({
      memory: { userId: 'u', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true, hydrated: true,
    });
  });

  it('updateEntry patches value and clears stale', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.6, sourceConversationId: 'c1' });
    const id = useMemoryStore.getState().memory.entries[0].id;
    useMemoryStore.setState((st) => ({ memory: { ...st.memory, entries: st.memory.entries.map((e) => ({ ...e, stale: true })) } }));
    s.updateEntry(id, { value: 'Krakow' });
    const e = useMemoryStore.getState().memory.entries[0];
    expect(e.value).toBe('Krakow');
    expect(e.stale).toBe(false);
  });

  it('updateEntry can persist a visual category without changing extraction category', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'goals', key: 'project', value: 'ship app', confidence: 0.9, sourceConversationId: 'c1' });
    const id = useMemoryStore.getState().memory.entries[0].id;
    s.updateEntry(id, { visualCategory: 'work' });
    const e = useMemoryStore.getState().memory.entries[0];
    expect(e.category).toBe('goals');
    expect(e.visualCategory).toBe('work');
  });

  it('deleteEdge removes one edge by id', () => {
    const s = useMemoryStore.getState();
    s.addEdge({ fromKey: 'a', toKey: 'b', relation: 'r' });
    const id = useMemoryStore.getState().memory.edges[0].id;
    s.deleteEdge(id);
    expect(useMemoryStore.getState().memory.edges).toHaveLength(0);
  });

  it('addManualEntry stores a fact with confidence 1 and manual source', () => {
    useMemoryStore.getState().addManualEntry({ category: 'goals', key: 'goal', value: 'ship app' });
    const e = useMemoryStore.getState().memory.entries[0];
    expect(e).toMatchObject({ key: 'goal', value: 'ship app', confidence: 1, sourceConversationId: 'manual' });
  });

  it('purgeStale removes stale entries and their dangling edges', () => {
    const s = useMemoryStore.getState();
    s.addOrUpdateEntry({ category: 'identity', key: 'a', value: 'x', confidence: 0.3, sourceConversationId: 'c' });
    s.addOrUpdateEntry({ category: 'identity', key: 'b', value: 'y', confidence: 0.9, sourceConversationId: 'c' });
    s.addEdge({ fromKey: 'a', toKey: 'b', relation: 'r' });
    useMemoryStore.setState((st) => ({ memory: { ...st.memory, entries: st.memory.entries.map((e) => e.key === 'a' ? { ...e, stale: true } : e) } }));
    s.purgeStale();
    const st = useMemoryStore.getState().memory;
    expect(st.entries.map((e) => e.key)).toEqual(['b']);
    expect(st.edges).toHaveLength(0);
  });
});
