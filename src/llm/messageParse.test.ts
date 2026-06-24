import { parseQuestion, segmentMessage } from './messageParse';

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
});
