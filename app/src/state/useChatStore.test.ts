jest.mock('@/llm/engine', () => ({ stop: jest.fn() }));

import { useChatStore } from './useChatStore';

const QUESTION_JSON = '{"__aether_question": true, "question": "What tone?", "options": ["Formal", "Casual"]}';

async function startChat(): Promise<void> {
  await useChatStore.getState().newChat('gemma4-e4b');
  await useChatStore.getState().appendUser('Write me an email');
}

function streamReply(text: string): void {
  const s = useChatStore.getState();
  s.startAssistant();
  for (const ch of text) s.appendToken(ch);
}

const lastMsg = () => {
  const msgs = useChatStore.getState().current!.messages;
  return msgs[msgs.length - 1];
};

describe('useChatStore terminal transitions', () => {
  beforeEach(async () => {
    useChatStore.setState({ index: [], current: null, isGenerating: false, assistantStream: null });
    await startChat();
  });

  it('streams ordinary prose into visible content before finalization', () => {
    const s = useChatStore.getState();
    s.startAssistant();
    s.appendToken('H');
    expect(lastMsg().content).toBe('H');
    expect(useChatStore.getState().isGenerating).toBe(true);
  });

  it('keeps visible prose monotonic and unchanged by finish', async () => {
    const s = useChatStore.getState();
    s.startAssistant();
    const seen: string[] = [];
    for (const ch of 'Hello') {
      s.appendToken(ch);
      seen.push(lastMsg().content);
    }
    expect(seen).toEqual(['H', 'He', 'Hel', 'Hell', 'Hello']);
    await useChatStore.getState().finishAssistant();
    expect(lastMsg().content).toBe('Hello');
  });

  it('never places question control JSON in visible streaming content', () => {
    const s = useChatStore.getState();
    s.startAssistant();
    for (const ch of QUESTION_JSON) {
      s.appendToken(ch);
      expect(lastMsg().content).not.toContain('__aether_question');
      expect(lastMsg().content).not.toContain('{"__');
    }
    expect(lastMsg().question).toEqual({ question: 'What tone?', options: ['Formal', 'Casual'] });
  });

  it('streams normal JSON/code-like content before finalization', () => {
    const json = '{"answer": true, "items": [1, 2]}';
    const s = useChatStore.getState();
    s.startAssistant();
    for (const ch of json) s.appendToken(ch);
    expect(lastMsg().content).toBe(json);
    expect(lastMsg().question).toBeUndefined();
  });

  it('hides partial copy protocol while preserving the live copy block once opened', () => {
    const s = useChatStore.getState();
    s.startAssistant();
    for (const ch of 'Here:\n<cop') s.appendToken(ch);
    expect(lastMsg().content).toBe('Here:\n');
    s.appendToken('y>\nDraft');
    expect(lastMsg().content).toBe('Here:\n<copy>\nDraft');
  });

  it('finishAssistant structures a question reply (content = prose only)', async () => {
    streamReply(QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.question).toEqual({ question: 'What tone?', options: ['Formal', 'Casual'] });
    expect(m.content).toBe('');
  });

  it('finishAssistant keeps prose that surrounded the question JSON', async () => {
    streamReply('One detail first.\n' + QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.question?.question).toBe('What tone?');
    expect(m.content).toBe('One detail first.');
  });

  it('finishAssistant salvages malformed question JSON into plain text', async () => {
    streamReply('{"__aether_question": true, "question": "What tone?", "opti');
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.question).toBeUndefined();
    expect(m.content).toBe('What tone?');
  });

  it('stopGeneration finalizes the partial reply and marks it stopped', async () => {
    streamReply('{"__aether_question": true, "question": "What tone?", "opti');
    useChatStore.getState().stopGeneration();
    const m = lastMsg();
    expect(m.stopped).toBe(true);
    expect(m.content).not.toContain('__aether_question');
    expect(useChatStore.getState().isGenerating).toBe(false);
  });

  it('stopGeneration removes unclosed copy protocol instead of persisting debris', () => {
    streamReply('Here:\n<copy>\nDraft text');
    useChatStore.getState().stopGeneration();
    const m = lastMsg();
    expect(m.stopped).toBe(true);
    expect(m.content).toBe('Here:\nDraft text');
    expect(m.content).not.toContain('<copy>');
  });

  it('native error finalization preserves prose and removes partial question debris', async () => {
    streamReply('Visible first.\n{"__aether_question": true, "question": "What tone?", "opti');
    useChatStore.getState().appendToken('\n\n_Error: engine died_');
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.content).toContain('Visible first.');
    expect(m.content).toContain('What tone?');
    expect(m.content).not.toContain('__aether_question');
    expect(m.content).not.toContain('"opti');
  });

  it('demotes a repeat of an already-asked question to plain text', async () => {
    streamReply(QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    await useChatStore.getState().appendUser('Formal');
    streamReply(QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.question).toBeUndefined();
    expect(m.content).toBe('What tone?');
  });

  it('a different follow-up question is NOT demoted', async () => {
    streamReply(QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    await useChatStore.getState().appendUser('Formal');
    streamReply('{"__aether_question": true, "question": "How long should it be?", "options": ["Short", "Detailed"]}');
    await useChatStore.getState().finishAssistant();
    expect(lastMsg().question?.question).toBe('How long should it be?');
  });

  it('recordQuestionAnswer persists the pick and is idempotent', async () => {
    streamReply(QUESTION_JSON);
    await useChatStore.getState().finishAssistant();
    const id = lastMsg().id;
    useChatStore.getState().recordQuestionAnswer(id, 'Casual');
    useChatStore.getState().recordQuestionAnswer(id, 'Formal');
    expect(lastMsg().questionAnswer).toBe('Casual');
  });

  it('normal replies are untouched by finalization', async () => {
    streamReply('Here is a normal answer with ```js\nx=1\n``` code.');
    await useChatStore.getState().finishAssistant();
    const m = lastMsg();
    expect(m.content).toBe('Here is a normal answer with ```js\nx=1\n``` code.');
    expect(m.question).toBeUndefined();
  });
});
