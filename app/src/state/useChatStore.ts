import { create } from 'zustand';
import { Conversation, ConversationMeta, Message, FileAttachment } from '@/types';
import type { AgentReceipt } from '@/agent/types';
import {
  loadIndex, loadConversation, saveConversation, createConversation, deleteConversation,
  setConversationTitle,
} from '@/storage/conversations';
import { stripSpecialTokens } from '@/llm/prompt';
import { finalizeAssistantText, projectAssistantStream, sameQuestion } from '@/llm/messageParse';

interface AssistantStreamState {
  messageId: string;
  raw: string;
}

interface ChatState {
  index: ConversationMeta[];
  current: Conversation | null;
  isGenerating: boolean;
  assistantStream: AssistantStreamState | null;
  refreshIndex: () => Promise<void>;
  newChat: (modelId: string) => Promise<string>;
  open: (id: string) => Promise<void>;
  setCurrentModel: (modelId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendUser: (content: string, attachments?: FileAttachment[], coreConsentToken?: string) => Promise<void>;
  startAssistant: () => void;
  appendToken: (token: string) => void;
  /** Replace the in-progress assistant message's content outright (research mode). */
  setAssistantContent: (content: string) => void;
  /** Record which Core notes were provided as context for the in-progress reply. */
  setAssistantRecall: (items: { key: string; why: string }[]) => void;
  /** Record the structured research handoff for the in-progress reply (Research mode). */
  setAssistantResearch: (research: NonNullable<Message['research']>) => void;
  /** Mark the in-progress assistant message as an agent task result. */
  setAssistantAgent: (taskId: string, receipt?: AgentReceipt) => void;
  finishAssistant: () => Promise<void>;
  /** Auto-name the current conversation (once) from its first exchange. */
  ensureTitle: () => Promise<void>;
  setGenerating: (g: boolean) => void;
  /** Persist which option the user tapped on a question card (idempotent). */
  recordQuestionAnswer: (messageId: string, option: string) => void;
  /** Abort the in-flight reply, keep the partial text, mark it "(stopped)". */
  stopGeneration: () => void;
  resetLocalState: () => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Normalize the trailing assistant message at a terminal transition (finish,
 * stop, error): strip leaked turn markers, finalize question JSON into
 * structured data (salvaging malformed output so the message always renders),
 * and demote a repeat of an already-asked question to plain text so a loop can
 * never stack duplicate interactive cards.
 */
function finalizeLastAssistant(messages: Message[], rawOverride?: string): Message[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return messages;
  const fin = finalizeAssistantText(stripSpecialTokens(rawOverride ?? last.content));
  let { content, question } = fin;
  if (question) {
    const q = question;
    const repeat = messages.slice(0, -1).some(
      (m) => m.role === 'assistant' && m.question && sameQuestion(m.question.question, q.question),
    );
    if (repeat) {
      content = [content, question.question].filter(Boolean).join('\n\n');
      question = undefined;
    }
  }
  if (content === last.content && !question && !last.question) return messages;
  const updated = [...messages];
  const { question: _oldQuestion, ...lastWithoutQuestion } = last;
  updated[updated.length - 1] = { ...lastWithoutQuestion, content, ...(question ? { question } : {}) };
  return updated;
}

export const useChatStore = create<ChatState>((set, get) => ({
  index: [],
  current: null,
  isGenerating: false,
  assistantStream: null,
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
  appendUser: async (content, attachments, coreConsentToken) => {
    const c = get().current;
    if (!c) return;
    const msg: Message = {
      id: uid(), role: 'user', content, createdAt: Date.now(),
      ...(attachments && attachments.length ? { attachments } : {}),
      ...(coreConsentToken ? { coreConsentToken } : {}),
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
    set({
      current: { ...c, messages: [...c.messages, msg] },
      isGenerating: true,
      assistantStream: { messageId: msg.id, raw: '' },
    });
  },
  appendToken: (token) => {
    // Ignore tokens that race in after the reply has been stopped/finished.
    if (!get().isGenerating) return;
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    const existing = get().assistantStream;
    const raw = existing?.messageId === last.id ? existing.raw + token : last.content + token;
    const projected = projectAssistantStream(stripSpecialTokens(raw));
    const { question: _oldQuestion, ...lastWithoutQuestion } = last;
    messages[messages.length - 1] = {
      ...lastWithoutQuestion,
      content: projected.content,
      ...(projected.question ? { question: projected.question } : {}),
    };
    set({ current: { ...c, messages }, assistantStream: { messageId: last.id, raw } });
  },
  setAssistantContent: (content) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    messages[messages.length - 1] = { ...last, content };
    set({ current: { ...c, messages }, assistantStream: { messageId: last.id, raw: content } });
  },
  setAssistantRecall: (items) => {
    const c = get().current;
    if (!c || !items.length) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    messages[messages.length - 1] = { ...last, coreRecall: items };
    set({ current: { ...c, messages } });
  },
  setAssistantResearch: (research) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    messages[messages.length - 1] = { ...last, research };
    set({ current: { ...c, messages } });
  },
  setAssistantAgent: (taskId, receipt) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    messages[messages.length - 1] = { ...last, agentTaskId: taskId, ...(receipt ? { agentReceipt: receipt } : {}) };
    set({ current: { ...c, messages } });
  },
  finishAssistant: async () => {
    set({ isGenerating: false });
    const c = get().current;
    if (!c) return;
    const stream = get().assistantStream;
    const last = c.messages[c.messages.length - 1];
    const raw = stream && last?.id === stream.messageId ? stream.raw : undefined;
    const updated = { ...c, messages: finalizeLastAssistant(c.messages, raw) };
    set({ current: updated, assistantStream: null });
    await saveConversation(updated);
    await get().refreshIndex();
  },
  ensureTitle: async () => {
    const c = get().current;
    if (!c) return;
    const meta = get().index.find((m) => m.id === c.id);
    if (meta?.titled) return;
    if (!c.messages.some((m) => m.role === 'assistant' && m.content.trim())) return;
    const { generateTitle } = require('@/llm/title') as typeof import('@/llm/title');
    const title = await generateTitle(c.messages);
    if (!title) return;
    await setConversationTitle(c.id, title);
    await get().refreshIndex();
  },
  setGenerating: (g) => set({ isGenerating: g }),
  recordQuestionAnswer: (messageId, option) => {
    const c = get().current;
    if (!c) return;
    const idx = c.messages.findIndex((m) => m.id === messageId);
    if (idx === -1 || c.messages[idx].questionAnswer) return;
    const messages = [...c.messages];
    messages[idx] = { ...messages[idx], questionAnswer: option };
    const updated = { ...c, messages };
    set({ current: updated });
    void saveConversation(updated);
  },
  stopGeneration: () => {
    try {
      const Llama = require('@/llm/engine') as typeof import('@/llm/engine');
      Llama.stop();
    } catch {}
    // A live Actions task must stop too: kernel flag + pending prompts resolved.
    try {
      const { useAgentStore } = require('@/state/useAgentStore') as typeof import('@/state/useAgentStore');
      if (useAgentStore.getState().liveKernel) useAgentStore.getState().cancelLive();
    } catch {}
    const c = get().current;
    if (!c) { set({ isGenerating: false, assistantStream: null }); return; }
    // Finalize the partial reply too: a stream stopped mid-question-JSON must
    // still leave a renderable message, never raw JSON or a stuck indicator.
    const stream = get().assistantStream;
    const lastBefore = c.messages[c.messages.length - 1];
    const raw = stream && lastBefore?.id === stream.messageId ? stream.raw : undefined;
    const messages = finalizeLastAssistant(c.messages, raw);
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      messages[messages.length - 1] = { ...last, stopped: true };
    }
    const updated = { ...c, messages };
    set({ current: updated, isGenerating: false, assistantStream: null });
    void saveConversation(updated);
  },
  resetLocalState: () => set({ index: [], current: null, isGenerating: false, assistantStream: null }),
}));
