import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { Conversation, ConversationMeta } from '@/types';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Strip heavy, non-displayable fields before persisting. Image `imageBase64`
 * can be several MB; storing it inline blows Android's ~2 MB SQLite
 * CursorWindow on read, which makes the whole conversation un-loadable. The
 * base64 is only needed transiently for the in-memory generation, so it never
 * needs to hit disk — the durable file `uri` is enough to redisplay the image.
 */
function forStorage(convo: Conversation): Conversation {
  return {
    ...convo,
    messages: convo.messages.map((m) =>
      m.attachments
        ? {
            ...m,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            attachments: m.attachments.map(({ imageBase64, ...rest }) => rest),
          }
        : m,
    ),
  };
}

export async function loadIndex(): Promise<ConversationMeta[]> {
  try {
    const list = safeParse<ConversationMeta[]>(
      await AsyncStorage.getItem(KEYS.conversationsIndex), [],
    );
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function saveIndex(index: ConversationMeta[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversationsIndex, JSON.stringify(index));
}

export async function createConversation(modelId: string): Promise<Conversation> {
  // A brand-new chat is persisted but intentionally kept out of the recents
  // index until it has a real message. saveConversation() inserts the index row
  // on the first message, so unstarted chats never clutter recents.
  const convo: Conversation = { id: newId(), modelId, messages: [] };
  await saveConversation(convo);
  return convo;
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  try {
    return safeParse<Conversation | null>(
      await AsyncStorage.getItem(KEYS.conversation(id)), null,
    );
  } catch {
    // A legacy row that exceeds SQLite's CursorWindow (e.g. an inlined image)
    // throws here — degrade to an empty conversation instead of crashing.
    return null;
  }
}

export async function saveConversation(convo: Conversation): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversation(convo.id), JSON.stringify(forStorage(convo)));
  const firstUser = convo.messages.find((m) => m.role === 'user');
  const last = convo.messages[convo.messages.length - 1];
  const index = await loadIndex();
  const i = index.findIndex((m) => m.id === convo.id);
  if (i >= 0) {
    index[i] = {
      ...index[i],
      modelId: convo.modelId,
      updatedAt: Date.now(),
      // Provisional title from the first message — only until a real AI title is locked in.
      title: index[i].titled ? index[i].title : (firstUser ? firstUser.content.slice(0, 40) : index[i].title),
      preview: last ? last.content.slice(0, 60) : '',
    };
    await saveIndex(index);
  } else if (convo.messages.length > 0) {
    // First message on a not-yet-indexed chat: add it to recents now.
    const now = Date.now();
    const meta: ConversationMeta = {
      id: convo.id,
      title: firstUser ? firstUser.content.slice(0, 40) : 'New chat',
      modelId: convo.modelId,
      createdAt: now,
      updatedAt: now,
      preview: last ? last.content.slice(0, 60) : '',
    };
    await saveIndex([meta, ...index]);
  }
}

/** Lock in a final (AI-generated) title for a conversation. */
export async function setConversationTitle(id: string, title: string): Promise<void> {
  const index = await loadIndex();
  const i = index.findIndex((m) => m.id === id);
  if (i < 0) return;
  index[i] = { ...index[i], title, titled: true };
  await saveIndex(index);
}

export async function deleteConversation(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.conversation(id));
  await saveIndex((await loadIndex()).filter((m) => m.id !== id));
}
