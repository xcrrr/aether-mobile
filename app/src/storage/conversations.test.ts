import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createConversation, saveConversation, loadConversation,
  loadIndex, deleteConversation,
} from './conversations';

beforeEach(() => AsyncStorage.clear());

describe('conversation storage', () => {
  it('creates a conversation and indexes it', async () => {
    const c = await createConversation('gemma4-e2b');
    expect(c.modelId).toBe('gemma4-e2b');
    expect(c.messages).toEqual([]);
    const index = await loadIndex();
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe(c.id);
  });
  it('saves messages and updates the index preview/title', async () => {
    const c = await createConversation('gemma4-e2b');
    c.messages.push({ id: 'm1', role: 'user', content: 'Hello world', createdAt: 1 });
    await saveConversation(c);
    expect((await loadConversation(c.id))!.messages).toHaveLength(1);
    const meta = (await loadIndex())[0];
    expect(meta.title).toBe('Hello world');
    expect(meta.preview).toBe('Hello world');
  });
  it('deletes a conversation and removes it from the index', async () => {
    const c = await createConversation('gemma4-e2b');
    await deleteConversation(c.id);
    expect(await loadConversation(c.id)).toBeNull();
    expect(await loadIndex()).toHaveLength(0);
  });
});
