import { buildMemorySystemPrompt } from './MemoryInjector';
import { MemoryEntry, MemoryCategory } from './types';

let n = 0;
function entry(p: Partial<MemoryEntry> & { category: MemoryCategory; key: string; value: string }): MemoryEntry {
  n += 1;
  return {
    id: `id-${n}`,
    confidence: 0.8,
    sourceConversationId: 'c1',
    createdAt: 0,
    updatedAt: 0,
    timesReinforced: 0,
    ...p,
  };
}

describe('buildMemorySystemPrompt', () => {
  it('returns empty string with no entries', () => {
    expect(buildMemorySystemPrompt([])).toBe('');
  });

  it('groups entries by category and renders key: value', () => {
    const out = buildMemorySystemPrompt([
      entry({ category: 'identity', key: 'preferred_name', value: 'Adam' }),
      entry({ category: 'preferences', key: 'main_hobby', value: 'climbing' }),
    ]);
    expect(out).toContain('What you know about this person:');
    expect(out).toContain('[identity]');
    expect(out).toContain('preferred_name: Adam');
    expect(out).toContain('[preferences]');
    expect(out).toContain('main_hobby: climbing');
    expect(out).toContain('Refer to the user by their preferred name');
  });

  it('sorts by timesReinforced then confidence', () => {
    const out = buildMemorySystemPrompt([
      entry({ category: 'identity', key: 'low', value: 'a', timesReinforced: 0, confidence: 0.9 }),
      entry({ category: 'identity', key: 'high', value: 'b', timesReinforced: 5, confidence: 0.1 }),
    ]);
    expect(out.indexOf('high:')).toBeLessThan(out.indexOf('low:'));
  });

  it('caps at 40 entries', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      entry({ category: 'context', key: `k${i}`, value: `v${i}`, timesReinforced: i }),
    );
    const out = buildMemorySystemPrompt(many);
    const count = (out.match(/^k\d+: /gm) || []).length;
    expect(count).toBe(40);
    // The highest-reinforced (k49) is kept; the lowest (k0) dropped.
    expect(out).toContain('k49: v49');
    expect(out).not.toContain('k0: v0');
  });
});
