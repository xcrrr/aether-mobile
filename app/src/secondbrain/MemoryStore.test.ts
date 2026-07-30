import { useMemoryStore, MemoryStore, dedupeEntries } from './MemoryStore';
import { MemoryEntry } from './types';
import { recallDisclosureItems, selectRecall } from './recall';
import { buildMemorySystemPrompt } from './MemoryInjector';
import { captureCoreSendSnapshot } from './CoreSendSnapshot';
import { useChatStore } from '@/state/useChatStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

describe('MemoryStore hydration gate', () => {
  it('ensureHydrated resolves and reports hydration so recall never reads an empty store on cold start', async () => {
    await expect(MemoryStore.ensureHydrated()).resolves.toBeUndefined();
    expect(MemoryStore.hasHydrated()).toBe(true);
  });

  it('persists a transparent disclosure for only the relevant correction after a cold restart', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Saturdays', confidence: 0.85,
      sourceConversationId: 'training-chat', evidence: 'I train for the race on Sundays',
    });
    const schedule = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(schedule.id, { value: 'Race training happens on Tuesdays' });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'reading_preference', value: 'Enjoys historical biographies', confidence: 0.9,
      sourceConversationId: 'reading-chat', evidence: 'I enjoy historical biographies',
    });

    const beforeRestart = useMemoryStore.getState();
    const persistedBeforeRestart = JSON.stringify({
      state: { memory: beforeRestart.memory, enabled: beforeRestart.enabled },
      version: 0,
    });
    useMemoryStore.setState({
      memory: { userId: 'cold-process', entries: [], edges: [], lastExtractionAt: 0, totalConversationsAnalyzed: 0 },
      enabled: true,
      recentKeys: [],
    });
    await AsyncStorage.setItem('aether_second_brain', persistedBeforeRestart);
    await useMemoryStore.persist.rehydrate();

    const core = await captureCoreSendSnapshot(MemoryStore);
    const recall = selectRecall([
      { id: 'u-cold', role: 'user', content: 'Which day is my race training?', createdAt: 1 },
    ], { entries: core.entries, enabled: core.enabled, activeModelId: 'gemma4-e4b' });

    expect(recall.topical.map((item) => item.entry.key)).toEqual(['race_schedule']);
    expect(buildMemorySystemPrompt(recall)).toContain('Race training happens on Tuesdays');
    expect(buildMemorySystemPrompt(recall)).not.toContain('historical biographies');

    // Drive the same assistant metadata path used by send(), then reopen the
    // conversation to prove the disclosure survives navigation/process state
    // loss and cannot pick up an unrelated persisted note.
    useChatStore.getState().resetLocalState();
    const conversationId = await useChatStore.getState().newChat('gemma4-e4b');
    await useChatStore.getState().appendUser('Which day is my race training?', undefined, core.consentToken);
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(recall));
    useChatStore.getState().appendToken('Your race training is on Tuesdays.');
    await useChatStore.getState().finishAssistant();

    useChatStore.getState().resetLocalState();
    await useChatStore.getState().open(conversationId);
    const reply = useChatStore.getState().current?.messages.at(-1);
    expect(reply?.coreRecall).toEqual([{
      key: 'race_schedule',
      why: expect.stringContaining('matched:'),
    }]);
    expect(reply?.coreRecall?.map((item) => item.key)).not.toContain('reading_preference');
  });

  it('keeps a deleted correction out of prompt grounding and disclosure after a cold restart', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Saturdays', confidence: 0.85,
      sourceConversationId: 'training-chat', evidence: 'I train for the race on Saturdays',
    });
    const schedule = MemoryStore.getAllEntries()[0];
    MemoryStore.updateEntry(schedule.id, { value: 'Race training happens on Tuesdays' });
    MemoryStore.deleteEntry(schedule.id);

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

    const core = await captureCoreSendSnapshot(MemoryStore);
    const recall = selectRecall([
      { id: 'u-deleted', role: 'user', content: 'Which day is my race training?', createdAt: 1 },
    ], { entries: core.entries, enabled: core.enabled, activeModelId: 'gemma4-e4b' });

    expect(core.entries).toEqual([]);
    expect(MemoryStore.getDeletions()).toEqual([expect.objectContaining({ key: 'race_schedule' })]);
    expect(recall.topical).toEqual([]);
    expect(buildMemorySystemPrompt(recall)).toBe('');
    expect(recallDisclosureItems(recall)).toEqual([]);

    useChatStore.getState().resetLocalState();
    const conversationId = await useChatStore.getState().newChat('gemma4-e4b');
    await useChatStore.getState().appendUser('Which day is my race training?', undefined, core.consentToken);
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(recall));
    useChatStore.getState().appendToken('I do not have a saved training day to rely on.');
    await useChatStore.getState().finishAssistant();

    useChatStore.getState().resetLocalState();
    await useChatStore.getState().open(conversationId);
    const reply = useChatStore.getState().current?.messages.at(-1);
    expect(reply?.coreRecall).toBeUndefined();
  });

  it('keeps a bulk Core clear out of prompt grounding and disclosure after a cold restart', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Tuesdays', confidence: 0.85,
      sourceConversationId: 'training-chat', evidence: 'I train for the race on Tuesdays',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'reading_preference', value: 'Enjoys historical biographies', confidence: 0.9,
      sourceConversationId: 'reading-chat', evidence: 'I enjoy historical biographies',
    });
    MemoryStore.clearAll();

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

    const core = await captureCoreSendSnapshot(MemoryStore);
    const recall = selectRecall([
      { id: 'u-cleared', role: 'user', content: 'Which day is my race training?', createdAt: 1 },
    ], { entries: core.entries, enabled: core.enabled, activeModelId: 'gemma4-e4b' });

    expect(core.entries).toEqual([]);
    expect(MemoryStore.getDeletions()).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'race_schedule' }),
      expect.objectContaining({ key: 'reading_preference' }),
    ]));
    expect(recall.topical).toEqual([]);
    expect(buildMemorySystemPrompt(recall)).toBe('');
    expect(recallDisclosureItems(recall)).toEqual([]);

    useChatStore.getState().resetLocalState();
    const conversationId = await useChatStore.getState().newChat('gemma4-e4b');
    await useChatStore.getState().appendUser('Which day is my race training?', undefined, core.consentToken);
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(recall));
    useChatStore.getState().appendToken('I do not have a saved training day to rely on.');
    await useChatStore.getState().finishAssistant();

    useChatStore.getState().resetLocalState();
    await useChatStore.getState().open(conversationId);
    const reply = useChatStore.getState().current?.messages.at(-1);
    expect(reply?.coreRecall).toBeUndefined();
  });

  it('keeps persisted notes private when Core is disabled across a cold restart', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Tuesdays', confidence: 0.85,
      sourceConversationId: 'training-chat', evidence: 'I train for the race on Tuesdays',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'reading_preference', value: 'Enjoys historical biographies', confidence: 0.9,
      sourceConversationId: 'reading-chat', evidence: 'I enjoy historical biographies',
    });
    MemoryStore.setEnabled(false);

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

    const core = await captureCoreSendSnapshot(MemoryStore);
    const recall = selectRecall([
      { id: 'u-disabled', role: 'user', content: 'Which day is my race training?', createdAt: 1 },
    ], { entries: core.entries, enabled: core.enabled, activeModelId: 'gemma4-e4b' });

    expect(MemoryStore.isEnabled()).toBe(false);
    expect(MemoryStore.getAllEntries().map((entry) => entry.key)).toEqual([
      'race_schedule',
      'reading_preference',
    ]);
    expect(core).toEqual({ enabled: false, entries: [] });
    expect(recall.topical).toEqual([]);
    expect(buildMemorySystemPrompt(recall)).toBe('');
    expect(recallDisclosureItems(recall)).toEqual([]);

    useChatStore.getState().resetLocalState();
    const conversationId = await useChatStore.getState().newChat('gemma4-e4b');
    await useChatStore.getState().appendUser('Which day is my race training?', undefined, core.consentToken);
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(recall));
    useChatStore.getState().appendToken('Core is off, so I did not use saved notes for that reply.');
    await useChatStore.getState().finishAssistant();

    useChatStore.getState().resetLocalState();
    await useChatStore.getState().open(conversationId);
    const messages = useChatStore.getState().current?.messages ?? [];
    expect(messages[0]?.coreConsentToken).toBeUndefined();
    expect(messages.at(-1)?.coreRecall).toBeUndefined();
  });

  it('restores persisted grounding only for sends after Core is re-enabled', async () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'race_schedule', value: 'Race training happens on Tuesdays', confidence: 0.85,
      sourceConversationId: 'training-chat', evidence: 'I train for the race on Tuesdays',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences', key: 'reading_preference', value: 'Enjoys historical biographies', confidence: 0.9,
      sourceConversationId: 'reading-chat', evidence: 'I enjoy historical biographies',
    });
    MemoryStore.setEnabled(false);

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

    useChatStore.getState().resetLocalState();
    const conversationId = await useChatStore.getState().newChat('gemma4-e4b');
    const disabledCore = await captureCoreSendSnapshot(MemoryStore);
    const disabledRecall = selectRecall([
      { id: 'u-disabled', role: 'user', content: 'Which day is my race training?', createdAt: 1 },
    ], { entries: disabledCore.entries, enabled: disabledCore.enabled, activeModelId: 'gemma4-e4b' });
    await useChatStore.getState().appendUser(
      'Which day is my race training?',
      undefined,
      disabledCore.consentToken,
    );
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(disabledRecall));
    useChatStore.getState().appendToken('Core is off, so I did not use saved notes for that reply.');
    await useChatStore.getState().finishAssistant();

    MemoryStore.setEnabled(true);
    const enabledCore = await captureCoreSendSnapshot(MemoryStore);
    const enabledRecall = selectRecall([
      { id: 'u-enabled', role: 'user', content: 'Which day is my race training?', createdAt: 2 },
    ], { entries: enabledCore.entries, enabled: enabledCore.enabled, activeModelId: 'gemma4-e4b' });
    await useChatStore.getState().appendUser(
      'Now that Core is on, which day is my race training?',
      undefined,
      enabledCore.consentToken,
    );
    useChatStore.getState().startAssistant();
    useChatStore.getState().setAssistantRecall(recallDisclosureItems(enabledRecall));
    useChatStore.getState().appendToken('Your race training is on Tuesdays.');
    await useChatStore.getState().finishAssistant();

    expect(buildMemorySystemPrompt(disabledRecall)).toBe('');
    expect(buildMemorySystemPrompt(enabledRecall)).toContain('Race training happens on Tuesdays');
    expect(buildMemorySystemPrompt(enabledRecall)).not.toContain('historical biographies');

    useChatStore.getState().resetLocalState();
    await useChatStore.getState().open(conversationId);
    const messages = useChatStore.getState().current?.messages ?? [];
    expect(messages[0]?.coreConsentToken).toBeUndefined();
    expect(messages[1]?.coreRecall).toBeUndefined();
    expect(messages[2]?.coreConsentToken).toBe(enabledCore.consentToken);
    expect(messages[3]?.coreRecall).toEqual([{
      key: 'race_schedule',
      why: expect.stringContaining('matched:'),
    }]);
  });
});

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

  it('a manual correction supersedes the prior fact in storage, recall, and prompt injection', () => {
    MemoryStore.addOrUpdateEntry({
      category: 'goals', key: 'october_marathon', value: 'Marathon in October', confidence: 0.85,
      sourceConversationId: 'c1', evidence: 'My marathon is in October', reason: 'You shared this goal',
    });
    const original = MemoryStore.getAllEntries()[0];

    MemoryStore.updateEntry(original.id, { value: 'Marathon moved to December' });

    const corrected = MemoryStore.getAllEntries()[0];
    expect(corrected).toMatchObject({
      id: original.id,
      value: 'Marathon moved to December',
      confidence: 1,
      sourceConversationId: 'manual',
      timesReinforced: 0,
      evidence: undefined,
      reason: 'You corrected this Core note',
    });
    expect(corrected.history?.[0]?.value).toBe('Marathon in October');

    const oldRecall = selectRecall([
      { id: 'u1', role: 'user', content: 'What are my October plans?', createdAt: 1 },
    ], { entries: [corrected], enabled: true, activeModelId: 'gemma4-e4b' });
    expect(oldRecall.topical).toEqual([]);

    const currentRecall = selectRecall([
      { id: 'u2', role: 'user', content: 'When is my marathon now?', createdAt: 2 },
    ], { entries: [corrected], enabled: true, activeModelId: 'gemma4-e4b' });
    expect(currentRecall.topical.map((item) => item.entry.value)).toEqual(['Marathon moved to December']);
    const prompt = buildMemorySystemPrompt(currentRecall);
    expect(prompt).toContain('Marathon moved to December');
    expect(prompt).not.toContain('Marathon in October');

    // A later conversation must not match the superseded month through the
    // original extraction key, which remains useful as the note's stable id.
    const nextConversationOldTopic = selectRecall([
      { id: 'u3', role: 'user', content: 'What are my October plans?', createdAt: 3 },
    ], { entries: MemoryStore.getAllEntries(), enabled: true, activeModelId: 'gemma4-e4b' });
    expect(nextConversationOldTopic.topical).toEqual([]);

    // Deleting the corrected note before another new conversation removes it
    // from both model context and the disclosure source set.
    MemoryStore.deleteEntry(original.id);
    const afterDelete = selectRecall([
      { id: 'u4', role: 'user', content: 'When is my marathon in December?', createdAt: 4 },
    ], { entries: MemoryStore.getAllEntries(), enabled: true, activeModelId: 'gemma4-e4b' });
    expect(afterDelete.topical).toEqual([]);
    expect(buildMemorySystemPrompt(afterDelete)).toBe('');
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

  it('does not reinforce the same model observation more than once', () => {
    const base = {
      category: 'identity' as const,
      key: 'city',
      value: 'Warsaw',
      confidence: 0.9,
      sourceConversationId: 'c1',
      evidence: 'I live in Warsaw',
      observedAt: 10,
    };
    expect(MemoryStore.addOrUpdateEntry({ ...base, evidenceMessageId: 'message-1' })).toBe(true);
    expect(MemoryStore.addOrUpdateEntry({ ...base, evidenceMessageId: 'message-1' })).toBe(false);
    expect(MemoryStore.getAllEntries()[0].timesReinforced).toBe(0);

    expect(MemoryStore.addOrUpdateEntry({
      ...base,
      sourceConversationId: 'c2',
      evidenceMessageId: 'message-2',
      observedAt: 20,
    })).toBe(true);
    expect(MemoryStore.getAllEntries()[0].timesReinforced).toBe(1);
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

  it('keeps semantically different facts even when their values match', () => {
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'birth_city', value: 'Warsaw', confidence: 0.8, sourceConversationId: 'c1' });
    MemoryStore.addOrUpdateEntry({ category: 'identity', key: 'current_city', value: 'Warsaw', confidence: 0.9, sourceConversationId: 'c2' });
    const all = MemoryStore.getAllEntries();
    expect(all).toHaveLength(2);
    expect(all.map((entry) => entry.key).sort()).toEqual(['birth_city', 'current_city']);
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

  it('rotates extraction consent when Core data is cleared or reset', () => {
    const beforeClear = MemoryStore.extractionConsentToken();
    MemoryStore.clearAll();
    const afterClear = MemoryStore.extractionConsentToken();
    expect(afterClear).not.toBe(beforeClear);

    MemoryStore.resetLocalState();
    expect(MemoryStore.extractionConsentToken()).not.toBe(afterClear);
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
  it('collapses duplicate normalized keys, keeping the strongest and folding counts', () => {
    const out = dedupeEntries([
      mkEntry({ id: 'a', category: 'identity', key: 'name', value: 'Adam', confidence: 0.7, timesReinforced: 0 }),
      mkEntry({ id: 'b', category: 'identity', key: 'Name!', value: 'adam.', confidence: 0.95, timesReinforced: 2 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('Name!'); // stronger copy wins
    expect(out[0].confidence).toBe(0.95);
    expect(out[0].timesReinforced).toBe(3);    // 0 + 2 + 1 merge
  });
  it('leaves distinct facts and cross-category matches untouched', () => {
    const out = dedupeEntries([
      mkEntry({ id: 'a', category: 'identity', key: 'birth_city', value: 'Warsaw' }),
      mkEntry({ id: 'b', category: 'context', key: 'current_city', value: 'Warsaw' }),
      mkEntry({ id: 'c', category: 'identity', key: 'preferred_name', value: 'Adam' }),
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
    expect(st.deletions).toEqual([
      expect.objectContaining({ category: 'identity', key: 'a' }),
    ]);
  });
});
