import { create } from 'zustand';
import { Conversation, ConversationMeta, Message, FileAttachment } from '@/types';
import {
  loadIndex, loadConversation, saveConversation, createConversation, deleteConversation,
} from '@/storage/conversations';
import * as Llama from '@/llm/engine';
import { stripSpecialTokens } from '@/llm/prompt';

interface ChatState {
  index: ConversationMeta[];
  current: Conversation | null;
  isGenerating: boolean;
  refreshIndex: () => Promise<void>;
  newChat: (modelId: string) => Promise<string>;
  open: (id: string) => Promise<void>;
  setCurrentModel: (modelId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendUser: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  startAssistant: () => void;
  appendToken: (token: string) => void;
  /** Replace the in-progress assistant message's content outright (research mode). */
  setAssistantContent: (content: string) => void;
  finishAssistant: () => Promise<void>;
  setGenerating: (g: boolean) => void;
  /** Abort the in-flight reply, keep the partial text, mark it "(stopped)". */
  stopGeneration: () => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  index: [],
  current: null,
  isGenerating: false,
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
  setCurrentModel: async (modelId) => {
    const c = get().current;
    if (!c || c.modelId === modelId) return;
    const updated = { ...c, modelId };
    set({ current: updated });
    await saveConversation(updated);
  },
  remove: async (id) => {
    await deleteConversation(id);
    if (get().current?.id === id) set({ current: null });
    await get().refreshIndex();
  },
  appendUser: async (content, attachments) => {
    const c = get().current;
    if (!c) return;
    const msg: Message = {
      id: uid(), role: 'user', content, createdAt: Date.now(),
      ...(attachments && attachments.length ? { attachments } : {}),
    };
    const updated = { ...c, messages: [...c.messages, msg] };
    set({ current: updated });
    await saveConversation(updated);
    await get().refreshIndex();
  },
  startAssistant: () => {
    const c = get().current;
    if (!c) return;
    const msg: Message = { id: uid(), role: 'assistant', content: '', createdAt: Date.now() };
    set({ current: { ...c, messages: [...c.messages, msg] }, isGenerating: true });
  },
  appendToken: (token) => {
    // Ignore tokens that race in after the reply has been stopped/finished.
    if (!get().isGenerating) return;
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = { ...last, content: last.content + token };
    set({ current: { ...c, messages } });
  },
  setAssistantContent: (content) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    messages[messages.length - 1] = { ...last, content };
    set({ current: { ...c, messages } });
  },
  finishAssistant: async () => {
    set({ isGenerating: false });
    const c = get().current;
    if (!c) return;
    // Clean any leaked Gemma turn markers from the finished reply before saving.
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      const cleaned = stripSpecialTokens(last.content);
      if (cleaned !== last.content) messages[messages.length - 1] = { ...last, content: cleaned };
    }
    const updated = { ...c, messages };
    set({ current: updated });
    await saveConversation(updated);
    await get().refreshIndex();
  },
  setGenerating: (g) => set({ isGenerating: g }),
  stopGeneration: () => {
    Llama.stop();
    const c = get().current;
    if (!c) { set({ isGenerating: false }); return; }
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      messages[messages.length - 1] = { ...last, stopped: true };
    }
    const updated = { ...c, messages };
    set({ current: updated, isGenerating: false });
    void saveConversation(updated);
  },
}));
