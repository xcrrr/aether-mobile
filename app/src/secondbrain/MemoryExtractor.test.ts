import { parseEntries, validateEntry, extractFromConversation, buildTranscript, parseLinks, extractionPolicy, messagesForConsent } from './MemoryExtractor';
import { Message } from '@/types';
import * as Llama from '@/llm/engine';
import { useMemoryStore, MemoryStore } from './MemoryStore';
import { useModelStore } from '@/state/useModelStore';
import { selectRecall } from './recall';
import { buildMemorySystemPrompt } from './MemoryInjector';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/llm/engine', () => ({ extract: jest.fn() }));
const mockExtract = Llama.extract as jest.MockedFunction<typeof Llama.extract>;

function reset() {
  useMemoryStore.setState({
    memory: { userId: 't', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
    enabled: true,
    recentKeys: [],
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

describe('automatic extraction consent scope', () => {
  it('excludes disabled-period and earlier-consent exchanges after Core is re-enabled', () => {
    const messages: Message[] = [
      { ...userMsg('I keep a private journal'), coreConsentToken: 'before-opt-out' },
      botMsg('That sounds useful.'),
      userMsg('My private account code is temporary'),
      botMsg('Understood.'),
      { ...userMsg('I am training for a marathon'), coreConsentToken: 'after-opt-in' },
      botMsg('I can help with your training plan.'),
    ];

    const eligible = messagesForConsent(messages, 'after-opt-in');

    expect(buildTranscript(eligible)).toBe(
      'User: I am training for a marathon\nAssistant: I can help with your training plan.',
    );
  });

  it('learns only the first newly consented exchange and recalls it after another cold restart', async () => {
    MemoryStore.setEnabled(false);
    const messages: Message[] = [
      userMsg('My temporary access phrase is river lantern'),
      botMsg('I will not save that while Core is off.'),
    ];

    MemoryStore.setEnabled(true);
    const consentToken = MemoryStore.extractionConsentToken();
    messages.push(
      { ...userMsg('I am training for a spring marathon'), coreConsentToken: consentToken },
      botMsg('I can help you plan the training.'),
    );

    mockExtract.mockImplementation(async (prompt) => {
      expect(prompt).not.toContain('river lantern');
      expect(prompt).toContain('I am training for a spring marathon');
      return JSON.stringify({
        facts: [{
          category: 'goals',
          key: 'spring_marathon',
          value: 'Training for a spring marathon',
          confidence: 0.95,
          quote: 'I am training for a spring marathon',
        }],
        links: [],
      });
    });

    const eligible = messagesForConsent(messages, consentToken);
    expect(await extractFromConversation(eligible, 'consented-conversation')).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        key: 'spring_marathon',
        sourceConversationId: 'consented-conversation',
      }),
    ]);

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'cold-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    const recall = selectRecall([userMsg('How should I prepare for my spring marathon?')], {
      entries: MemoryStore.getAllEntries(),
      enabled: MemoryStore.isEnabled(),
      activeModelId: 'gemma4-e4b',
    });
    const prompt = buildMemorySystemPrompt(recall);
    expect(recall.topical.map((item) => item.entry.key)).toEqual(['spring_marathon']);
    expect(prompt).toContain('Training for a spring marathon');
    expect(prompt).not.toContain('river lantern');
  });
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
    expect(extractionPolicy('gemma4-e4b')).toEqual({ minConfidence: 0.7, maxFacts: 7, maxLinks: 4 });
  });
  it('is stricter for E2B and for unknown models', () => {
    expect(extractionPolicy('gemma4-e2b')).toEqual({ minConfidence: 0.8, maxFacts: 4, maxLinks: 3 });
    expect(extractionPolicy(null)).toEqual({ minConfidence: 0.8, maxFacts: 4, maxLinks: 3 });
  });
});

describe('extractFromConversation', () => {
  const convo = [userMsg('hi'), botMsg('hello'), userMsg('i love climbing')];

  it('skips when disabled', async () => {
    MemoryStore.setEnabled(false);
    await extractFromConversation(convo, 'c1');
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('waits for cold rehydration and keeps a queued automatic extraction inert when persisted Core is disabled', async () => {
    let finishHydration: () => void = () => {};
    const hydration = new Promise<void>((resolve) => {
      finishHydration = resolve;
    });
    const ensureHydrated = jest.spyOn(MemoryStore, 'ensureHydrated').mockReturnValue(hydration);

    const queuedExtraction = extractFromConversation(convo, 'c1');
    await Promise.resolve();
    expect(ensureHydrated).toHaveBeenCalledTimes(1);
    expect(mockExtract).not.toHaveBeenCalled();

    MemoryStore.setEnabled(false);
    finishHydration();

    await expect(queuedExtraction).resolves.toBe(0);
    expect(mockExtract).not.toHaveBeenCalled();
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(0);
    ensureHydrated.mockRestore();
  });

  it('discards an in-flight manual analysis when Core is disabled before it completes', async () => {
    let finishExtraction: (value: string) => void = () => {};
    mockExtract.mockImplementation(() => new Promise((resolve) => {
      finishExtraction = resolve;
    }));

    const analysis = extractFromConversation(convo, 'c1', { force: true });
    await Promise.resolve();
    expect(mockExtract).toHaveBeenCalled();

    MemoryStore.setEnabled(false);
    finishExtraction(fact());

    await expect(analysis).resolves.toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(0);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);
  });

  it('coalesces overlapping manual analysis of the same conversation', async () => {
    let finishExtraction: (value: string) => void = () => {};
    mockExtract.mockImplementation(() => new Promise((resolve) => {
      finishExtraction = resolve;
    }));

    const firstTap = extractFromConversation(convo, 'c1', { force: true });
    const secondTap = extractFromConversation(convo, 'c1', { force: true });
    await Promise.resolve();

    expect(mockExtract).toHaveBeenCalledTimes(1);
    finishExtraction(fact());

    await expect(Promise.all([firstTap, secondTap])).resolves.toEqual([1, 1]);
    expect(MemoryStore.getAllEntries()).toHaveLength(1);
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(1);
  });

  it('discards delayed automatic output across a Core disable and re-enable cycle', async () => {
    let finishExtraction: (value: string) => void = () => {};
    mockExtract.mockImplementation(() => new Promise((resolve) => {
      finishExtraction = resolve;
    }));
    const consentToken = MemoryStore.extractionConsentToken();

    const extraction = extractFromConversation(convo, 'c1', { consentToken });
    await Promise.resolve();
    expect(mockExtract).toHaveBeenCalled();

    MemoryStore.setEnabled(false);
    MemoryStore.setEnabled(true);
    finishExtraction(fact());

    await expect(extraction).resolves.toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().memory.totalConversationsAnalyzed).toBe(0);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);
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

  it('E2B saves at most 4 facts and requires 0.8 confidence', async () => {
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
    expect(await extractFromConversation(chat, 'c1')).toBe(4);
    expect(MemoryStore.getAllEntries()).toHaveLength(4);
    // The fifth candidate is dropped by the 0.8 confidence gate, not by the cap.
    expect(MemoryStore.getAllEntries().map((e) => e.key)).not.toContain('game');
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

  it('supersedes a changed fact emitted under a plausible alternate key', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Marathon in October', confidence: 0.9,
      sourceConversationId: 'c0', evidence: 'My marathon is in October',
    });
    const original = MemoryStore.getAllEntries()[0];
    const chat = [userMsg('My marathon was moved from October to December.')];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_schedule', value: 'Marathon in December',
        confidence: 0.95, quote: 'My marathon was moved from October to December.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(chat, 'c1')).toBe(1);

    const entries = MemoryStore.getAllEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: original.id,
      key: 'marathon_date',
      value: 'Marathon in December',
      sourceConversationId: 'c1',
      timesReinforced: 0,
    });
    expect(entries[0].history?.[0]?.value).toBe('Marathon in October');
    expect(useMemoryStore.getState().recentKeys).toEqual(['marathon_date']);

    const recall = selectRecall([userMsg('When is my marathon now?')], {
      entries,
      enabled: true,
      activeModelId: 'gemma4-e4b',
    });
    const prompt = buildMemorySystemPrompt(recall);
    expect(prompt).toContain('Marathon in December');
    expect(prompt).not.toContain('Marathon in October');
  });

  it('does not let re-analysis of an older conversation overwrite a manual correction', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Marathon in October', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'My marathon is in October',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { value: 'Marathon moved to December' });
    MemoryStore.clearRecentKeys();
    const correctedAt = MemoryStore.getAllEntries()[0].updatedAt;
    const oldChat: Message[] = [{
      ...userMsg('My marathon is in October.'),
      createdAt: correctedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon in October',
        confidence: 0.95, quote: 'My marathon is in October.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        id: original.id,
        value: 'Marathon moved to December',
        sourceConversationId: 'manual',
        updatedAt: correctedAt,
      }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('My marathon has now moved to January.'),
      createdAt: correctedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon moved to January',
        confidence: 0.95, quote: 'My marathon has now moved to January.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()[0]).toMatchObject({
      id: original.id,
      value: 'Marathon moved to January',
      sourceConversationId: 'later-conversation',
    });
  });

  it('keeps the strongest current value when a later extraction also replays a stale alternate key', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Sundays', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'Race training happens on Sundays',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { value: 'Tuesdays' });
    const correctedAt = MemoryStore.getAllEntries()[0].updatedAt;
    const laterChat: Message[] = [{
      ...userMsg('Tuesdays are still my race training day. Sundays were my old race training day.'),
      createdAt: correctedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [
        {
          category: 'goals', key: 'race_schedule', value: 'Tuesdays',
          confidence: 0.98, quote: 'Tuesdays are still my race training day',
        },
        {
          category: 'goals', key: 'race_training_schedule', value: 'Sundays',
          confidence: 0.82, quote: 'Sundays were my old race training day',
        },
      ],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        id: original.id,
        key: 'race_schedule',
        value: 'Tuesdays',
        sourceConversationId: 'later-conversation',
        timesReinforced: 1,
      }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual(['race_schedule']);
  });

  it('keeps a manual category correction authoritative across older replay and later updates', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { category: 'goals' });
    MemoryStore.clearRecentKeys();
    const correctedAt = MemoryStore.getAllEntries()[0].updatedAt;
    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: correctedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        id: original.id,
        category: 'goals',
        value: 'Weekly long run',
        sourceConversationId: 'manual',
        updatedAt: correctedAt,
      }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: correctedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        id: original.id,
        category: 'goals',
        value: 'Two long runs each week',
        sourceConversationId: 'later-conversation',
      }),
    ]);
  });

  it('does not revive a deleted note from an older conversation but accepts a later statement', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Marathon in October', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'My marathon is in October',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.deleteEntry(original.id);
    MemoryStore.clearRecentKeys();
    const deletedAt = Date.now();
    const oldChat: Message[] = [{
      ...userMsg('My marathon is in October.'),
      createdAt: deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon in October',
        confidence: 0.95, quote: 'My marathon is in October.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('My marathon is now in February.'),
      createdAt: deletedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon in February',
        confidence: 0.95, quote: 'My marathon is now in February.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        key: 'marathon_date',
        value: 'Marathon in February',
        sourceConversationId: 'later-conversation',
      }),
    ]);
  });

  it('preserves a deleted category correction across former-category replay and a later update', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { category: 'goals' });
    MemoryStore.deleteEntry(original.id);
    MemoryStore.clearRecentKeys();
    const deletedAt = MemoryStore.getDeletions()[0].deletedAt;
    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: deletedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        value: 'Two long runs each week',
        sourceConversationId: 'later-conversation',
      }),
    ]);
  });

  it('preserves a bulk-cleared category correction across former-category replay and a later update', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { category: 'goals' });
    MemoryStore.clearAll();
    const clearedAt = MemoryStore.getDeletions()[0].deletedAt;
    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: clearedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: clearedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        value: 'Two long runs each week',
        sourceConversationId: 'later-conversation',
      }),
    ]);
  });

  it('preserves a category correction through restart before bulk clear and former-category replay', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    MemoryStore.updateEntry(MemoryStore.getAllEntries()[0].id, { category: 'goals' });

    // Persist the exact public state shape, discard the in-memory copy, and
    // rehydrate it as a cold process would before the user clears Core.
    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    // setState persists by design; install the captured disk payload after the
    // reset to model a newly-created store reading the prior process's data.
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        categoryAliases: ['preferences'],
      }),
    ]);

    MemoryStore.clearAll();
    const deletion = MemoryStore.getDeletions()[0];
    expect(deletion).toMatchObject({
      category: 'goals',
      key: 'marathon_training',
      categoryAliases: ['preferences'],
    });

    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: deletion.deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);
  });

  it('preserves bulk-clear tombstones through restart while accepting only a newer corrected-category update', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    MemoryStore.updateEntry(MemoryStore.getAllEntries()[0].id, { category: 'goals' });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'favorite_drink', value: 'Tea', confidence: 0.9,
      sourceConversationId: 'old-preference', evidence: 'Tea is my favorite drink',
    });
    MemoryStore.clearAll();

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    const clearedAt = MemoryStore.getDeletions()[0].deletedAt;
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(MemoryStore.getDeletions()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        categoryAliases: ['preferences'],
        deletedAt: clearedAt,
      }),
      expect.objectContaining({
        category: 'preferences',
        key: 'favorite_drink',
        deletedAt: clearedAt,
      }),
    ]));

    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: clearedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: clearedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        value: 'Two long runs each week',
        sourceConversationId: 'later-conversation',
      }),
    ]);
    expect(MemoryStore.getAllEntries()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'favorite_drink' }),
    ]));
    expect(useMemoryStore.getState().recentKeys).toEqual(['marathon_training']);
  });

  it('keeps ambiguous bulk-clear replay deleted and restores only a newer exact corrected note', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'training-conversation', evidence: 'I do a weekly long run',
    });
    MemoryStore.updateEntry(MemoryStore.getAllEntries()[0].id, { category: 'goals' });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_schedule', value: 'Race in October', confidence: 0.9,
      sourceConversationId: 'schedule-conversation', evidence: 'My race is in October',
    });
    MemoryStore.updateEntry(MemoryStore.getAllEntries()[1].id, { category: 'goals' });
    MemoryStore.clearAll();

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    const clearedAt = MemoryStore.getDeletions()[0].deletedAt;
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    const staleAmbiguousChat: Message[] = [{
      ...userMsg('My marathon plan included strength training.'),
      createdAt: clearedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_plan', value: 'Included strength training',
        confidence: 0.95, quote: 'My marathon plan included strength training.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(staleAmbiguousChat, 'stale-replay', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);
    expect(MemoryStore.getDeletions()).toHaveLength(2);

    const newerAmbiguousChat: Message[] = [{
      ...userMsg('My marathon plan now includes mobility work.'),
      createdAt: clearedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_plan', value: 'Includes mobility work',
        confidence: 0.95, quote: 'My marathon plan now includes mobility work.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(newerAmbiguousChat, 'newer-plan', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'preferences',
        key: 'marathon_plan',
        value: 'Includes mobility work',
      }),
    ]);
    expect(MemoryStore.getDeletions()).toHaveLength(2);

    const newerExactChat: Message[] = [{
      ...userMsg('My marathon training is now two long runs each week.'),
      createdAt: clearedAt + 2,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Two long runs each week',
        confidence: 0.95, quote: 'My marathon training is now two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(newerExactChat, 'newer-training', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'preferences',
        key: 'marathon_plan',
        value: 'Includes mobility work',
      }),
      expect.objectContaining({
        category: 'goals',
        categoryAliases: ['preferences'],
        key: 'marathon_training',
        value: 'Two long runs each week',
      }),
    ]));
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
    expect(MemoryStore.getDeletions()).toEqual([
      expect.objectContaining({ category: 'goals', key: 'marathon_schedule' }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual(['marathon_training']);
  });

  it('preserves an individually deleted category correction through restart when extraction changes key', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'I do a weekly long run',
    });
    const original = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(original.id, { category: 'goals' });
    MemoryStore.deleteEntry(original.id);
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Race in October', confidence: 0.9,
      sourceConversationId: 'date-conversation', evidence: 'My race is in October',
    });

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    const deletedAt = MemoryStore.getDeletions()[0].deletedAt;
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ key: 'marathon_date', value: 'Race in October' }),
    ]);
    expect(MemoryStore.getDeletions()).toEqual([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        categoryAliases: ['preferences'],
        deletedAt,
      }),
    ]);

    const oldChat: Message[] = [{
      ...userMsg('I do a weekly long run.'),
      createdAt: deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Weekly long run',
        confidence: 0.95, quote: 'I do a weekly long run.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ key: 'marathon_date', value: 'Race in October' }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: deletedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'goals',
        key: 'marathon_training',
        value: 'Two long runs each week',
        sourceConversationId: 'later-conversation',
      }),
      expect.objectContaining({ key: 'marathon_date', value: 'Race in October' }),
    ]));
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
    expect(useMemoryStore.getState().recentKeys).toEqual(['marathon_training']);
  });

  it('does not map a newer alternate key onto an unrelated tombstone when deletion authority is ambiguous', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'training-conversation', evidence: 'I do a weekly long run',
    });
    const training = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(training.id, { category: 'goals' });
    MemoryStore.deleteEntry(training.id);
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_date', value: 'Race in October', confidence: 0.9,
      sourceConversationId: 'date-conversation', evidence: 'My race is in October',
    });
    MemoryStore.deleteEntry(MemoryStore.getAllEntries()[0].id);

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    const newestDeletionAt = Math.max(...MemoryStore.getDeletions().map((item) => item.deletedAt));
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    const laterChat: Message[] = [{
      ...userMsg('I now do two long runs each week.'),
      createdAt: newestDeletionAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Two long runs each week',
        confidence: 0.95, quote: 'I now do two long runs each week.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'preferences',
        key: 'marathon_routine',
        value: 'Two long runs each week',
      }),
    ]);
    expect(MemoryStore.getDeletions()).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'goals', key: 'marathon_training' }),
      expect.objectContaining({ category: 'preferences', key: 'marathon_date' }),
    ]));
    expect(MemoryStore.getDeletions()).toHaveLength(2);
  });

  it('restores only the exact corrected note after an ambiguous note and preserves its category authority', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'training-conversation', evidence: 'I do a weekly long run',
    });
    const training = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(training.id, { category: 'goals' });
    const originalCorrectionAt = MemoryStore.getAllEntries()[0].categoryCorrectedAt;
    MemoryStore.deleteEntry(training.id);
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'marathon_date', value: 'Race in October', confidence: 0.9,
      sourceConversationId: 'date-conversation', evidence: 'My race is in October',
    });
    MemoryStore.deleteEntry(MemoryStore.getAllEntries()[0].id);

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();
    const newestDeletionAt = Math.max(...MemoryStore.getDeletions().map((item) => item.deletedAt));

    const ambiguousChat: Message[] = [{
      ...userMsg('My marathon routine is now two long runs each week.'),
      createdAt: newestDeletionAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_routine', value: 'Two long runs each week',
        confidence: 0.95, quote: 'My marathon routine is now two long runs each week.',
      }],
      links: [],
    }));
    expect(await extractFromConversation(ambiguousChat, 'ambiguous-conversation', { force: true })).toBe(1);

    const afterAmbiguousLearning = useMemoryStore.getState();
    const persistedAfterAmbiguousLearning = JSON.stringify({
      state: { memory: afterAmbiguousLearning.memory, enabled: afterAmbiguousLearning.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'ambiguous-fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedAfterAmbiguousLearning);
    await useMemoryStore.persist.rehydrate();

    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({
        category: 'preferences',
        key: 'marathon_routine',
        value: 'Two long runs each week',
      }),
    ]);
    expect(MemoryStore.getDeletions()).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'goals', key: 'marathon_training' }),
      expect.objectContaining({ category: 'preferences', key: 'marathon_date' }),
    ]));
    expect(MemoryStore.getDeletions()).toHaveLength(2);

    const exactChat: Message[] = [{
      ...userMsg('My marathon training is now three long runs each week.'),
      createdAt: newestDeletionAt + 2,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Three long runs each week',
        confidence: 0.95, quote: 'My marathon training is now three long runs each week.',
      }],
      links: [],
    }));
    expect(await extractFromConversation(exactChat, 'exact-conversation', { force: true })).toBe(1);

    const laterFormerCategoryChat: Message[] = [{
      ...userMsg('My marathon training is now four long runs each week.'),
      createdAt: newestDeletionAt + 3,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Four long runs each week',
        confidence: 0.95, quote: 'My marathon training is now four long runs each week.',
      }],
      links: [],
    }));
    expect(await extractFromConversation(laterFormerCategoryChat, 'later-conversation', { force: true })).toBe(1);

    expect(MemoryStore.getAllEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'preferences', key: 'marathon_routine' }),
      expect.objectContaining({
        category: 'goals',
        categoryAliases: ['preferences'],
        key: 'marathon_training',
        value: 'Four long runs each week',
      }),
    ]));
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
    expect(MemoryStore.getDeletions()).toEqual([
      expect.objectContaining({ category: 'preferences', key: 'marathon_date' }),
    ]);
    expect(useMemoryStore.getState().recentKeys).toEqual(['marathon_training']);

    const restoredTraining = MemoryStore.getAllEntries().find(
      (entry) => entry.key === 'marathon_training',
    )!;
    MemoryStore.deleteEntry(restoredTraining.id);
    const renewedDeletion = MemoryStore.getDeletions().find(
      (deletion) => deletion.key === 'marathon_training',
    )!;

    const beforeSecondRestart = useMemoryStore.getState();
    const persistedBeforeSecondRestart = JSON.stringify({
      state: { memory: beforeSecondRestart.memory, enabled: beforeSecondRestart.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'second-fresh-process', entries: [], edges: [], deletions: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeSecondRestart);
    await useMemoryStore.persist.rehydrate();

    const staleFormerCategoryChat: Message[] = [{
      ...userMsg('My marathon training was four long runs each week.'),
      createdAt: renewedDeletion.deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Four long runs each week',
        confidence: 0.95, quote: 'My marathon training was four long runs each week.',
      }],
      links: [],
    }));
    expect(await extractFromConversation(staleFormerCategoryChat, 'stale-replay', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ category: 'preferences', key: 'marathon_routine' }),
    ]);

    const newerFormerCategoryChat: Message[] = [{
      ...userMsg('My marathon training is now five long runs each week.'),
      createdAt: renewedDeletion.deletedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'preferences', key: 'marathon_training', value: 'Five long runs each week',
        confidence: 0.95, quote: 'My marathon training is now five long runs each week.',
      }],
      links: [],
    }));
    expect(await extractFromConversation(newerFormerCategoryChat, 'newer-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'preferences', key: 'marathon_routine' }),
      expect.objectContaining({
        category: 'goals',
        categoryAliases: ['preferences'],
        categoryCorrectedAt: originalCorrectionAt,
        key: 'marathon_training',
        value: 'Five long runs each week',
      }),
    ]));
    expect(MemoryStore.getAllEntries()).toHaveLength(2);
    expect(MemoryStore.getDeletions()).toEqual([
      expect.objectContaining({ category: 'preferences', key: 'marathon_date' }),
    ]);
  });

  it('does not revive notes cleared in bulk from older conversations but accepts a later statement', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Marathon in October', confidence: 0.9,
      sourceConversationId: 'old-goal', evidence: 'My marathon is in October',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'favorite_drink', value: 'Tea', confidence: 0.9,
      sourceConversationId: 'old-preference', evidence: 'Tea is my favorite drink',
    });
    MemoryStore.clearAll();
    const clearedAt = Date.now();

    const oldChat: Message[] = [{
      ...userMsg('My marathon is in October.'),
      createdAt: clearedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon in October',
        confidence: 0.95, quote: 'My marathon is in October.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-goal', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('My marathon is now in February.'),
      createdAt: clearedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_date', value: 'Marathon in February',
        confidence: 0.95, quote: 'My marathon is now in February.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-goal', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ key: 'marathon_date', value: 'Marathon in February' }),
    ]);
    expect(MemoryStore.getDeletions()).toEqual([
      expect.objectContaining({ category: 'preferences', key: 'favorite_drink' }),
    ]);
  });

  it('applies deletion authority to one unambiguous alternate key without suppressing ambiguous concepts', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_date', value: 'Marathon in October', confidence: 0.9,
      sourceConversationId: 'old-conversation', evidence: 'My marathon is in October',
    });
    MemoryStore.deleteEntry(MemoryStore.getAllEntries()[0].id);
    const deletedAt = Date.now();
    const oldChat: Message[] = [{
      ...userMsg('My marathon is in October.'),
      createdAt: deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_schedule', value: 'Marathon in October',
        confidence: 0.95, quote: 'My marathon is in October.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(oldChat, 'old-conversation', { force: true })).toBe(0);
    expect(MemoryStore.getAllEntries()).toEqual([]);

    const laterChat: Message[] = [{
      ...userMsg('My marathon is now in February.'),
      createdAt: deletedAt + 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_schedule', value: 'Marathon in February',
        confidence: 0.95, quote: 'My marathon is now in February.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(laterChat, 'later-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ key: 'marathon_date', value: 'Marathon in February' }),
    ]);

    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9,
      sourceConversationId: 'training-conversation',
    });
    MemoryStore.deleteEntry(MemoryStore.getAllEntries().find((entry) => entry.key === 'marathon_training')!.id);
    MemoryStore.deleteEntry(MemoryStore.getAllEntries().find((entry) => entry.key === 'marathon_date')!.id);
    const ambiguousOldChat: Message[] = [{
      ...userMsg('My marathon plan includes strength training.'),
      createdAt: deletedAt - 1,
    }];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{
        category: 'goals', key: 'marathon_plan', value: 'Includes strength training',
        confidence: 0.95, quote: 'My marathon plan includes strength training.',
      }],
      links: [],
    }));

    expect(await extractFromConversation(ambiguousOldChat, 'plan-conversation', { force: true })).toBe(1);
    expect(MemoryStore.getAllEntries()).toEqual([
      expect.objectContaining({ key: 'marathon_plan', value: 'Includes strength training' }),
    ]);
  });

  it('does not merge alternate keys when their distinctive anchor is ambiguous', async () => {
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'marathon_date', value: 'October race', confidence: 0.9, sourceConversationId: 'c0' });
    MemoryStore.addOrUpdateEntry({ category: 'goals', key: 'marathon_training', value: 'Weekly long run', confidence: 0.9, sourceConversationId: 'c0' });
    const chat = [userMsg('My marathon plan now includes strength training.')];
    mockExtract.mockResolvedValue(JSON.stringify({
      facts: [{ category: 'goals', key: 'marathon_plan', value: 'Includes strength training', confidence: 0.95, quote: 'My marathon plan now includes strength training.' }],
      links: [],
    }));

    await extractFromConversation(chat, 'c1');

    expect(MemoryStore.getAllEntries().map((entry) => entry.key).sort()).toEqual([
      'marathon_date', 'marathon_plan', 'marathon_training',
    ]);
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
