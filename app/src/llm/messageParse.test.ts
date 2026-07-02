import {
  parseQuestion, extractQuestion, finalizeAssistantText, segmentMessage,
  messageModelText, projectAssistantStream, questionHistoryText, sameQuestion,
} from './messageParse';
import { Message } from '@/types';

describe('parseQuestion', () => {
  it('parses a bare aether-question JSON object', () => {
    const q = parseQuestion('{"__aether_question": true, "question": "What kind?", "options": ["A", "B"]}');
    expect(q).toEqual({ question: 'What kind?', options: ['A', 'B'] });
  });

  it('parses a question wrapped in a ```json code fence', () => {
    const text = '```json\n{"__aether_question": true, "question": "Pick one", "options": ["X", "Y", "None of the above"]}\n```';
    const q = parseQuestion(text);
    expect(q).toEqual({ question: 'Pick one', options: ['X', 'Y', 'None of the above'] });
  });

  it('tolerates surrounding prose around the JSON block', () => {
    const text = 'Sure!\n{"__aether_question": true, "question": "Q?", "options": ["one"]}';
    expect(parseQuestion(text)?.question).toBe('Q?');
  });

  it('returns null for plain text', () => {
    expect(parseQuestion('Here is a normal answer.')).toBeNull();
  });

  it('returns null for JSON without the marker', () => {
    expect(parseQuestion('{"question": "Q?", "options": ["a"]}')).toBeNull();
  });

  it('returns null for partial/streaming JSON that does not parse yet', () => {
    expect(parseQuestion('{"__aether_question": true, "question": "Q?", "opti')).toBeNull();
  });

  it('returns null when options are empty', () => {
    expect(parseQuestion('{"__aether_question": true, "question": "Q?", "options": []}')).toBeNull();
  });

  it('drops non-string options', () => {
    const q = parseQuestion('{"__aether_question": true, "question": "Q?", "options": ["a", 3, null, "b"]}');
    expect(q?.options).toEqual(['a', 'b']);
  });

  it('forgives a trailing comma (Gemma near-miss JSON)', () => {
    const q = parseQuestion('{"__aether_question": true, "question": "Q?", "options": ["a", "b",]}');
    expect(q?.options).toEqual(['a', 'b']);
  });

  it('accepts the marker as a string "true"', () => {
    const q = parseQuestion('{"__aether_question": "true", "question": "Q?", "options": ["a"]}');
    expect(q?.question).toBe('Q?');
  });

  it('parses when an option contains a closing brace', () => {
    const q = parseQuestion('{"__aether_question": true, "question": "Q?", "options": ["use {x}", "b"]}');
    expect(q?.options).toEqual(['use {x}', 'b']);
  });
});

describe('extractQuestion', () => {
  it('preserves prose streamed before and after the JSON', () => {
    const text = 'Happy to help!\n{"__aether_question": true, "question": "Q?", "options": ["a"]}\nJust let me know.';
    const ex = extractQuestion(text);
    expect(ex?.question.question).toBe('Q?');
    expect(ex?.prose).toBe('Happy to help!\n\nJust let me know.');
  });

  it('removes the emptied ```json fence with the JSON', () => {
    const text = 'Intro\n```json\n{"__aether_question": true, "question": "Q?", "options": ["a"]}\n```';
    expect(extractQuestion(text)?.prose).toBe('Intro');
  });
});

describe('finalizeAssistantText', () => {
  it('passes plain text through untouched', () => {
    expect(finalizeAssistantText('A normal answer.')).toEqual({ content: 'A normal answer.' });
  });

  it('structures a valid question and keeps surrounding prose', () => {
    const fin = finalizeAssistantText('Context first.\n{"__aether_question": true, "question": "Q?", "options": ["a", "b"]}');
    expect(fin.question).toEqual({ question: 'Q?', options: ['a', 'b'] });
    expect(fin.content).toBe('Context first.');
  });

  it('salvages the question text from truncated JSON (interrupted stream)', () => {
    const fin = finalizeAssistantText('{"__aether_question": true, "question": "What tone should the email have?", "opti');
    expect(fin.question).toBeUndefined();
    expect(fin.content).toBe('What tone should the email have?');
  });

  it('keeps prose and drops the junk when JSON is malformed beyond salvage', () => {
    const fin = finalizeAssistantText('Here is my answer.\n{"__aether_question": tru');
    expect(fin.question).toBeUndefined();
    expect(fin.content).toBe('Here is my answer.');
  });

  it('never returns raw marker JSON as content', () => {
    const fin = finalizeAssistantText('{"__aether_question": true, "question": "Q?", "options": ["a"]}');
    expect(fin.content).not.toContain('__aether_question');
  });

  it('keeps an appended error line after truncated question JSON', () => {
    const fin = finalizeAssistantText('{"__aether_question": true, "question": "Q?", "opt\n\n_Error: engine died_');
    expect(fin.content).toContain('Q?');
    expect(fin.content).not.toContain('__aether_question');
  });

  it('keeps closed copy blocks renderable after persistence', () => {
    const fin = finalizeAssistantText('Here:\n<copy>\nDraft text\n</copy>');
    expect(fin.content).toContain('<copy>');
    expect(fin.content).toContain('</copy>');
  });

  it('removes an unclosed copy opener at terminal transitions', () => {
    const fin = finalizeAssistantText('Here:\n<copy>\nDraft text');
    expect(fin.content).toBe('Here:\nDraft text');
    expect(fin.content).not.toContain('<copy>');
  });
});

describe('projectAssistantStream', () => {
  it('streams ordinary prose immediately', () => {
    expect(projectAssistantStream('H')).toEqual({ content: 'H', holding: false });
    expect(projectAssistantStream('Hello')).toEqual({ content: 'Hello', holding: false });
  });

  it('does not swallow normal JSON once it diverges from Aether protocol', () => {
    const projected = projectAssistantStream('{"answer": true, "items": [1, 2]}');
    expect(projected.content).toBe('{"answer": true, "items": [1, 2]}');
    expect(projected.question).toBeUndefined();
  });

  it('does not misclassify normal fenced JSON/code as a control payload', () => {
    const text = '```json\n{"answer": true}\n```';
    expect(projectAssistantStream(text).content).toBe(text);
  });

  it('hides question protocol prefixes and payloads while they stream', () => {
    expect(projectAssistantStream('{').content).toBe('');
    const partial = projectAssistantStream('{"__aether_question": true, "question": "What tone?", "opti');
    expect(partial.content).toBe('');
    expect(partial.holding).toBe(true);
    expect(partial.content).not.toContain('__aether_question');
  });

  it('structures a complete question payload without exposing raw JSON', () => {
    const projected = projectAssistantStream('Lead-in.\n{"__aether_question": true, "question": "What tone?", "options": ["Formal", "Casual"]}');
    expect(projected.content).toBe('Lead-in.');
    expect(projected.question).toEqual({ question: 'What tone?', options: ['Formal', 'Casual'] });
  });

  it('hides partial copy tags but shows normal angle-bracket text after divergence', () => {
    expect(projectAssistantStream('Here: <cop').content).toBe('Here: ');
    expect(projectAssistantStream('<View style={x}>').content).toBe('<View style={x}>');
  });

  it('hides a partial closing copy tag so it cannot leak into the live card', () => {
    expect(projectAssistantStream('<copy>\nDraft</co').content).toBe('<copy>\nDraft');
  });

  it('keeps the normal fast path to cheap prefix checks and no protocol parsing result', () => {
    const text = 'A'.repeat(5000);
    expect(projectAssistantStream(text)).toEqual({ content: text, holding: false });
  });
});

describe('segmentMessage', () => {
  it('returns a single text segment for plain prose', () => {
    expect(segmentMessage('Just a normal reply.')).toEqual([
      { type: 'text', content: 'Just a normal reply.' },
    ]);
  });

  it('extracts a <copy> block between text', () => {
    const text = 'Here you go:\n<copy>\nMy caption text\n</copy>\nLet me know!';
    expect(segmentMessage(text)).toEqual([
      { type: 'text', content: 'Here you go:' },
      { type: 'copy', content: 'My caption text' },
      { type: 'text', content: 'Let me know!' },
    ]);
  });

  it('extracts a fenced code block with a language', () => {
    const text = 'Run this:\n```bash\nnpm install\n```';
    expect(segmentMessage(text)).toEqual([
      { type: 'text', content: 'Run this:' },
      { type: 'code', content: 'npm install', lang: 'bash' },
    ]);
  });

  it('extracts a fenced code block without a language', () => {
    const text = '```\nplain code\n```';
    expect(segmentMessage(text)).toEqual([
      { type: 'code', content: 'plain code' },
    ]);
  });

  it('handles multiple blocks in order', () => {
    const text = 'A\n<copy>cap</copy>\nB\n```js\nx=1\n```\nC';
    expect(segmentMessage(text)).toEqual([
      { type: 'text', content: 'A' },
      { type: 'copy', content: 'cap' },
      { type: 'text', content: 'B' },
      { type: 'code', content: 'x=1', lang: 'js' },
      { type: 'text', content: 'C' },
    ]);
  });

  it('drops empty text segments around blocks', () => {
    expect(segmentMessage('<copy>only</copy>')).toEqual([
      { type: 'copy', content: 'only' },
    ]);
  });

  it('preserves internal indentation and blank lines in code payloads', () => {
    const code = 'def f():\n    if x:\n\n        return 1';
    const segs = segmentMessage('```python\n' + code + '\n```');
    expect(segs).toEqual([{ type: 'code', content: code, lang: 'python' }]);
  });

  describe('streaming mode', () => {
    it('turns a trailing unclosed <copy> into a pending copy block', () => {
      const segs = segmentMessage('Here:\n<copy>\nDear team,\nQuick update', { streaming: true });
      expect(segs).toEqual([
        { type: 'text', content: 'Here:' },
        { type: 'copy', content: 'Dear team,\nQuick update', pending: true },
      ]);
    });

    it('turns a trailing unclosed fence into a pending code block', () => {
      const segs = segmentMessage('Run:\n```bash\nnpm i', { streaming: true });
      expect(segs).toEqual([
        { type: 'text', content: 'Run:' },
        { type: 'code', content: 'npm i', lang: 'bash', pending: true },
      ]);
    });

    it('a just-opened fence with no newline yet is pending and empty', () => {
      const segs = segmentMessage('```', { streaming: true });
      expect(segs).toEqual([{ type: 'code', content: '', pending: true }]);
    });

    it('closed blocks are not pending even in streaming mode', () => {
      const segs = segmentMessage('```js\nx=1\n```', { streaming: true });
      expect(segs).toEqual([{ type: 'code', content: 'x=1', lang: 'js' }]);
    });

    it('without streaming mode a dangling opener stays plain text', () => {
      expect(segmentMessage('see <copy>half')).toEqual([
        { type: 'text', content: 'see <copy>half' },
      ]);
    });
  });
});

describe('model history rewriting', () => {
  const msg = (over: Partial<Message>): Message =>
    ({ id: 'x', role: 'assistant', content: '', createdAt: 0, ...over });

  it('renders a structured question turn as natural language, never JSON', () => {
    const m = msg({ question: { question: 'What tone?', options: ['Formal', 'Casual'] } });
    expect(messageModelText(m)).toBe('What tone? (options: Formal / Casual)');
  });

  it('keeps prose ahead of the question text', () => {
    const m = msg({ content: 'One thing first.', question: { question: 'Q?', options: ['a'] } });
    expect(messageModelText(m)).toBe('One thing first.\n\nQ? (options: a)');
  });

  it('converts legacy raw-JSON content (pre-migration messages)', () => {
    const m = msg({ content: '{"__aether_question": true, "question": "What tone?", "options": ["Formal", "Casual"]}' });
    expect(messageModelText(m)).toBe('What tone? (options: Formal / Casual)');
    expect(messageModelText(m)).not.toContain('__aether_question');
  });

  it('passes normal assistant and user messages through', () => {
    expect(messageModelText(msg({ content: 'Hello!' }))).toBe('Hello!');
    expect(messageModelText(msg({ role: 'user', content: 'hi' }))).toBe('hi');
  });

  it('strips copy protocol from model history without changing visible rendering data', () => {
    const m = msg({ content: 'Use this:\n<copy>\nDraft text\n</copy>' });
    expect(messageModelText(m)).toBe('Use this:\nDraft text');
    expect(messageModelText(m)).not.toContain('<copy>');
  });

  it('questionHistoryText formats options inline', () => {
    expect(questionHistoryText({ question: 'Q?', options: ['a', 'b'] })).toBe('Q? (options: a / b)');
  });
});

describe('sameQuestion', () => {
  it('matches ignoring case and punctuation', () => {
    expect(sameQuestion('What tone should it have?', 'what tone should it have')).toBe(true);
  });
  it('rejects different questions and empties', () => {
    expect(sameQuestion('What tone?', 'Which platform?')).toBe(false);
    expect(sameQuestion('', '')).toBe(false);
  });
});
