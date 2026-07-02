import { parseEntries, validateEntry, extractFromConversation, buildTranscript, parseLinks, extractionPolicy } from './MemoryExtractor';
import { Message } from '@/types';
import * as Llama from '@/llm/engine';
import { useMemoryStore, MemoryStore } from './MemoryStore';
import { useModelStore } from '@/state/useModelStore';

jest.mock('@/llm/engine', () => ({ extract: jest.fn() }));
const mockExtract = Llama.extract as jest.MockedFunction<typeof Llama.extract>;

function reset() {
  useMemoryStore.setState({
    memory: { userId: 't', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
    enabled: true,
  });
  useModelStore.setState({ activeModelId: 'gemma4-e4b' });
  mockExtract.mockReset();
}
beforeEach(reset);

const userMsg = (content: string): Message => ({ id: content, role: 'user', content, createdAt: 0 });
const botMsg = (content: string): Message => ({ id: content, role: 'assistant', content, createdAt: 0 });

const fact = (over: Record<string, unknown> = {}) => JSON.stringify({
  facts: [{ category: 'preferences', key: 'hobby', value: 'climbing', confidence: 0.9, quote: 'i love climbing', ...over }],
  links: [],
});

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
  const base = { category: 'identity', key: 'Preferred Name', value: ' Adam ', confidence: 0.9, quote: 'call me Adam' };
  it('accepts and normalises a valid entry', () => {
    expect(validateEntry(base))
      .toEqual({ category: 'identity', key: 'preferred_name', value: 'Adam', confidence: 0.9, quote: 'call me Adam' });
  });
  it('rejects unknown categories', () => {
    expect(validateEntry({ ...base, category: 'nonsense' })).toBeNull();
  });
  it('rejects empty key or value', () => {
    expect(validateEntry({ ...base, key: '' })).toBeNull();
    expect(validateEntry({ ...base, value: '  ' })).toBeNull();
  });
  it('rejects a fact without a quote — evidence is mandatory', () => {
    const { quote: _q, ...noQuote } = base;
    expect(validateEntry(noQuote)).toBeNull();
    expect(validateEntry({ ...base, quote: '   ' })).toBeNull();
  });
  it('clamps out-of-range confidence and zeroes missing confidence', () => {
    expect(validateEntry({ ...base, confidence: 5 })?.confidence).toBe(1);
    const { confidence: _c, ...noConf } = base;
    expect(validateEntry(noConf)?.confidence).toBe(0);
  });
  it('caps value length to 200 chars', () => {
    const v = validateEntry({ ...base, value: 'x'.repeat(500) });
    expect(v && v.value.length).toBe(200);
  });
});

describe('extractionPolicy', () => {
  it('gives E4B the baseline policy', () => {
    expect(extractionPolicy('gemma4-e4b')).toEqual({ minConfidence: 0.7, maxFacts: 5, maxLinks: 3 });
  });
  it('is stricter for E2B and for unknown models', () => {
    expect(extractionPolicy('gemma4-e2b')).toEqual({ minConfidence: 0.8, maxFacts: 3, maxLinks: 2 });
    expect(extractionPolicy(null)).toEqual({ minConfidence: 0.8, maxFacts: 3, maxLinks: 2 });
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
    mockExtract.mockResolvedValue('{"facts":[],"links":[]}');
    await extractFromConversation([userMsg('I run a barbershop'), botMsg('Nice!')], 'c1');
    expect(mockExtract).toHaveBeenCalled();
  });

  it('skips a trivial greeting-only exchange without inference', async () => {
    await extractFromConversation([userMsg('hey there'), botMsg('hello!')], 'c1');
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('skips an empty exchange (no user messages)', async () => {
    await extractFromConversation([botMsg('hello')], 'c1');
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('saves a grounded fact with evidence and a reason', async () => {
    mockExtract.mockResolvedValue(fact());
    expect(await extractFromConversation(convo, 'c1')).toBe(1);

    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('climbing');
    expect(all[0].evidence).toBe('i love climbing');
    expect(all[0].reason).toBeTruthy();
    expect(all[0].sourceConversationId).toBe('c1');
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(1);
  });

  it('drops a fact whose quote is not in any user message (hallucination)', async () => {
    mockExtract.mockResolvedValue(fact({ quote: 'i am a professional astronaut' }));
    expect(await extractFromConversation(convo, 'c1')).toBe(0);
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('drops a fact grounded only in ASSISTANT text', async () => {
    const chat = [userMsg('tell me about hobbies'), botMsg('you clearly love alpine skiing')];
    mockExtract.mockResolvedValue(fact({ key: 'sport', value: 'alpine skiing', quote: 'you clearly love alpine skiing' }));
    expect(await extractFromConversation(chat, 'c1')).toBe(0);
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('drops a fact without a quote even when confidence is high', async () => {
    mockExtract.mockResolvedValue('{"facts":[{"category":"preferences","key":"hobby","value":"climbing","confidence":0.99}],"links":[]}');
    expect(await extractFromConversation(convo, 'c1')).toBe(0);
  });

  it('drops facts below the model confidence gate', async () => {
    mockExtract.mockResolvedValue(fact({ confidence: 0.5 }));
    expect(await extractFromConversation(convo, 'c1')).toBe(0);
  });

  it('E2B saves at most 3 facts and requires 0.8 confidence', async () => {
    useModelStore.setState({ activeModelId: 'gemma4-e2b' });
    const chat = [userMsg('i love climbing and i live in Warsaw and i am a lawyer and my dog is named Rex and i play chess')];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [
        { category: 'preferences', key: 'hobby', value: 'climbing', confidence: 0.9, quote: 'i love climbing' },
        { category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.9, quote: 'i live in Warsaw' },
        { category: 'identity', key: 'job', value: 'lawyer', confidence: 0.9, quote: 'i am a lawyer' },
        { category: 'relationships', key: 'dog', value: 'Rex', confidence: 0.9, quote: 'my dog is named Rex' },
        { category: 'preferences', key: 'game', value: 'chess', confidence: 0.75, quote: 'i play chess' },
      ],
      links: [],
    }));
    expect(await extractFromConversation(chat, 'c1')).toBe(3);
    expect(MemoryStore.getAllEntries()).toHaveLength(3);
  });

  it('no-ops on null inference or unparseable output', async () => {
    mockExtract.mockResolvedValue(null);
    await extractFromConversation(convo, 'c1');
    mockExtract.mockResolvedValue('garbage');
    await extractFromConversation(convo, 'c1');
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('a truncated JSON response causes no writes and no crash', async () => {
    mockExtract.mockResolvedValue('{"facts":[{"category":"preferences","key":"hobby","va');
    expect(await extractFromConversation(convo, 'c1')).toBe(0);
    expect(MemoryStore.getAllEntries()).toHaveLength(0);
  });

  it('records the learned keys as recent for the graph highlight', async () => {
    useMemoryStore.setState({ recentKeys: [] });
    const chat = [userMsg('i love climbing and i live in Warsaw')];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [
        { category: 'preferences', key: 'hobby', value: 'climbing', confidence: 0.9, quote: 'i love climbing' },
        { category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.9, quote: 'i live in Warsaw' },
      ],
      links: [],
    }));
    await extractFromConversation(chat, 'c1');
    expect(useMemoryStore.getState().recentKeys.sort()).toEqual(['city', 'hobby']);
  });

  it('leaves recent keys untouched when nothing is learned', async () => {
    useMemoryStore.setState({ recentKeys: ['prior'] });
    mockExtract.mockResolvedValue('{"facts":[],"links":[]}');
    await extractFromConversation(convo, 'c1');
    expect(useMemoryStore.getState().recentKeys).toEqual(['prior']);
  });

  it('force passes preempt to the model so it never silently yields', async () => {
    mockExtract.mockResolvedValue('{"facts":[],"links":[]}');
    await extractFromConversation(convo, 'c1', { force: true });
    expect(mockExtract).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ preempt: true }));
  });

  it('injects already-known facts into the prompt so the model stops re-saving them', async () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.9, sourceConversationId: 'c0' });
    mockExtract.mockResolvedValue('{"facts":[],"links":[]}');
    await extractFromConversation(convo, 'c1');
    const prompt = mockExtract.mock.calls[0][0] as string;
    expect(prompt).toContain('city');
    expect(prompt).toContain('Warsaw');
    expect(prompt.toLowerCase()).toContain('already');
  });

  it('only saves links whose endpoints are saved facts', async () => {
    const chat = [userMsg('i run Mitruk barber shop and i live in Warsaw')];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [
        { category: 'identity', key: 'business_name', value: 'Mitruk barber shop', confidence: 0.9, quote: 'i run Mitruk barber shop' },
        { category: 'identity', key: 'city', value: 'Warsaw', confidence: 0.9, quote: 'i live in Warsaw' },
      ],
      links: [
        { from_key: 'business_name', to_key: 'city', relation: 'located_in' },
        { from_key: 'business_name', to_key: 'ghost_key', relation: 'related_to' },
      ],
    }));
    await extractFromConversation(chat, 'c1');
    const edges = useMemoryStore.getState().memory.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromKey: 'business_name', toKey: 'city', relation: 'located_in' });
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
    const raw = '{"links":[{"from_key":"a"},{"from_key":"a","to_key":"b","relation":"works_at"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'a', toKey: 'b', relation: 'works_at' }]);
  });
  it('normalises relations to snake_case and drops garbage relations', () => {
    const raw = '{"links":[{"from_key":"a","to_key":"b","relation":"Located In"},{"from_key":"a","to_key":"b","relation":"!!!"}]}';
    expect(parseLinks(raw)).toEqual([{ fromKey: 'a', toKey: 'b', relation: 'located_in' }]);
  });
});
