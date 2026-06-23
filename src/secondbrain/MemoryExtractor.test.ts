import { parseEntries, validateEntry, extractFromConversation, buildTranscript, parseLinks } from './MemoryExtractor';
import { Message } from '@/types';
import * as Llama from '@/llm/LlamaService';
import { useMemoryStore, MemoryStore } from './MemoryStore';

jest.mock('@/llm/LlamaService', () => ({ extract: jest.fn() }));
const mockExtract = Llama.extract as jest.MockedFunction<typeof Llama.extract>;

function reset() {
  useMemoryStore.setState({
    memory: { userId: 't', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
    enabled: true,
  });
  mockExtract.mockReset();
}
beforeEach(reset);

const userMsg = (content: string): Message => ({ id: content, role: 'user', content, createdAt: 0 });
const botMsg = (content: string): Message => ({ id: content, role: 'assistant', content, createdAt: 0 });

describe('parseEntries', () => {
  it('parses a clean JSON array', () => {
    expect(parseEntries('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it('extracts an array wrapped in markdown / prose', () => {
    expect(parseEntries('Sure!\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });
  it('returns null on malformed JSON', () => {
    expect(parseEntries('[not json')).toBeNull();
  });
  it('returns null when no array present', () => {
    expect(parseEntries('no brackets here')).toBeNull();
  });
  it('wraps a single bare object in an array', () => {
    expect(parseEntries('{"category":"identity","key":"name","value":"Adam"}'))
      .toEqual([{ category: 'identity', key: 'name', value: 'Adam' }]);
  });
  it('tolerates trailing commas from small models', () => {
    expect(parseEntries('[{"a":1},{"b":2},]')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('buildTranscript', () => {
  it('keeps the most recent messages within the char budget', () => {
    const msgs: Message[] = Array.from({ length: 20 }, (_, i) => userMsg('x'.repeat(300) + i));
    const t = buildTranscript(msgs, 1000);
    expect(t.length).toBeLessThanOrEqual(1000);
    expect(t).toContain('19'); // newest kept
    expect(t).not.toContain('User: ' + 'x'.repeat(300) + '0\n'); // oldest dropped
  });
});

describe('validateEntry', () => {
  it('accepts and normalises a valid entry', () => {
    expect(validateEntry({ category: 'identity', key: 'Preferred Name', value: ' Adam ', confidence: 0.9 }))
      .toEqual({ category: 'identity', key: 'preferred_name', value: 'Adam', confidence: 0.9 });
  });
  it('rejects unknown categories', () => {
    expect(validateEntry({ category: 'nonsense', key: 'k', value: 'v', confidence: 1 })).toBeNull();
  });
  it('rejects empty key or value', () => {
    expect(validateEntry({ category: 'goals', key: '', value: 'v', confidence: 1 })).toBeNull();
    expect(validateEntry({ category: 'goals', key: 'k', value: '  ', confidence: 1 })).toBeNull();
  });
  it('clamps out-of-range confidence and defaults missing confidence', () => {
    expect(validateEntry({ category: 'goals', key: 'k', value: 'v', confidence: 5 })?.confidence).toBe(1);
    expect(validateEntry({ category: 'goals', key: 'k', value: 'v' })?.confidence).toBe(0.5);
  });
});

describe('extractFromConversation', () => {
  const convo = [userMsg('hi'), botMsg('hello'), userMsg('i love climbing')];

  it('skips when disabled', async () => {
    MemoryStore.setEnabled(false);
    await extractFromConversation(convo, 'c1');
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('runs after the very first user message', async () => {
    mockExtract.mockResolvedValue('[]');
    await extractFromConversation([userMsg('I run a barbershop'), botMsg('Nice!')], 'c1');
    expect(mockExtract).toHaveBeenCalled();
  });

  it('skips an empty exchange (no user messages)', async () => {
    await extractFromConversation([botMsg('hello')], 'c1');
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('upserts valid entries and records the extraction', async () => {
    mockExtract.mockResolvedValue(
      '[{"category":"preferences","key":"hobby","value":"climbing","confidence":0.9},' +
      '{"category":"bogus","key":"x","value":"y","confidence":1}]',
    );
    await extractFromConversation(convo, 'c1');

    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1); // bogus category skipped
    expect(all[0].value).toBe('climbing');
    expect(all[0].sourceConversationId).toBe('c1');
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(1);
  });

  it('no-ops on null inference or unparseable output', async () => {
    mockExtract.mockResolvedValue(null);
    await extractFromConversation(convo, 'c1');
    mockExtract.mockResolvedValue('garbage');
    await extractFromConversation(convo, 'c1');
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('returns the count of applied facts', async () => {
    mockExtract.mockResolvedValue(
      '[{"category":"preferences","key":"hobby","value":"climbing","confidence":0.9}]',
    );
    expect(await extractFromConversation(convo, 'c1')).toBe(1);
  });

  it('force passes preempt to the model so it never silently yields', async () => {
    mockExtract.mockResolvedValue('[]');
    await extractFromConversation(convo, 'c1', { force: true });
    expect(mockExtract).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ preempt: true }));
  });
});

describe('parseLinks', () => {
  it('extracts a links array of {from_key,to_key,relation}', () => {
    const raw = '{"facts":[],"links":[{"from_key":"business_name","to_key":"city","relation":"located_in"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'business_name', toKey: 'city', relation: 'located_in' }]);
  });
  it('returns [] when no links present', () => {
    expect(parseLinks('[{"category":"identity","key":"x","value":"y","confidence":0.9}]')).toEqual([]);
  });
  it('skips malformed link objects', () => {
    const raw = '{"links":[{"from_key":"a"},{"from_key":"a","to_key":"b","relation":"r"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'a', toKey: 'b', relation: 'r' }]);
  });
});
