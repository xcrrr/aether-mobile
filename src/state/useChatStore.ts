import { create } from 'zustand';
import { Conversation, ConversationMeta, Message } from '@/types';
import {
  loadIndex, loadConversation, saveConversation, createConversation, deleteConversation,
} from '@/storage/conversations';

interface ChatState {
  index: ConversationMeta[];
  current: Conversation | null;
  generating: boolean;
  refreshIndex: () => Promise<void>;
  newChat: (modelId: string) => Promise<string>;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendUser: (content: string) => Promise<void>;
  startAssistant: () => void;
  appendToken: (token: string) => void;
  finishAssistant: () => Promise<void>;
  setGenerating: (g: boolean) => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  index: [],
  current: null,
  generating: false,
  refreshIndex: async () => set({ index: await loadIndex() }),
  newChat: async (modelId) => {
    const c = await createConversation(modelId);
    set({ current: c });
    await get().refreshIndex();
    return c.id;
  },
  open: async (id) => {
    set({ current: await loadConversation(id) });
  },
  remove: async (id) => {
    await deleteConversation(id);
    if (get().current?.id === id) set({ current: null });
    await get().refreshIndex();
  },
  appendUser: async (content) => {
    const c = get().current;
    if (!c) return;
    const msg: Message = { id: uid(), role: 'user', content, createdAt: Date.now() };
    const updated = { ...c, messages: [...c.messages, msg] };
    set({ current: updated });
    await saveConversation(updated);
    await get().refreshIndex();
  },
  startAssistant: () => {
    const c = get().current;
    if (!c) return;
    const msg: Message = { id: uid(), role: 'assistant', content: '', createdAt: Date.now() };
    set({ current: { ...c, messages: [...c.messages, msg] }, generating: true });
  },
  appendToken: (token) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = { ...last, content: last.content + token };
    set({ current: { ...c, messages } });
  },
  finishAssistant: async () => {
    const c = get().current;
    set({ generating: false });
    if (c) { await saveConversation(c); await get().refreshIndex(); }
  },
  setGenerating: (g) => set({ generating: g }),
}));
