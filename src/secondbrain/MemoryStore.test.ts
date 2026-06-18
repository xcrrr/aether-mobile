import { useMemoryStore, MemoryStore } from './MemoryStore';

function reset() {
  useMemoryStore.setState({
    memory: { userId: 'test-user', entries: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
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

  it('upserts on matching category + key, incrementing timesReinforced', () => {
    const base = { category: 'identity' as const, key: 'preferred_name', sourceConversationId: 'c1' };
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Adam', confidence: 0.7 });
    const created = MemoryStore.getAllEntries()[0];
    MemoryStore.addOrUpdateEntry({ ...base, value: 'Adam P', confidence: 0.95 });

    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].value).toBe('Adam P');
    expect(all[0].confidence).toBe(0.95);
    expect(all[0].timesReinforced).toBe(1);
  });

  it('treats same key in a different category as distinct', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'x', value: 'a', confidence: 1, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'x', value: 'b', confidence: 1, sourceConversationId: 'c1' });
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
