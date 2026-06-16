import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { Conversation, ConversationMeta } from '@/types';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function loadIndex(): Promise<ConversationMeta[]> {
  const list = safeParse<ConversationMeta[]>(
    await AsyncStorage.getItem(KEYS.conversationsIndex), [],
  );
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function saveIndex(index: ConversationMeta[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversationsIndex, JSON.stringify(index));
}

export async function createConversation(modelId: string): Promise<Conversation> {
  const now = Date.now();
  const convo: Conversation = { id: newId(), modelId, messages: [] };
  await saveConversation(convo);
  const meta: ConversationMeta = {
    id: convo.id, title: 'New chat', modelId, createdAt: now, updatedAt: now, preview: '',
  };
  await saveIndex([meta, ...(await loadIndex())]);
  return convo;
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  return safeParse<Conversation | null>(
    await AsyncStorage.getItem(KEYS.conversation(id)), null,
  );
}

export async function saveConversation(convo: Conversation): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversation(convo.id), JSON.stringify(convo));
  const firstUser = convo.messages.find((m) => m.role === 'user');
  const last = convo.messages[convo.messages.length - 1];
  const index = await loadIndex();
  const i = index.findIndex((m) => m.id === convo.id);
  if (i >= 0) {
    index[i] = {
      ...index[i],
      modelId: convo.modelId,
      updatedAt: Date.now(),
      title: firstUser ? firstUser.content.slice(0, 40) : index[i].title,
      preview: last ? last.content.slice(0, 60) : '',
    };
    await saveIndex(index);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.conversation(id));
  await saveIndex((await loadIndex()).filter((m) => m.id !== id));
}
