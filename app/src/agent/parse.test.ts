import { parseAction, actionKey, looksLikeFinish, normalizeKey, ACTION_MARKER } from './parse';

describe('parseAction', () => {
  it('parses a clean action object', () => {
    const out = parseAction(`{"${ACTION_MARKER}": true, "tool": "web_research", "args": {"query": "gemma 4"}}`);
    expect(out).toEqual({ tool: 'web_research', args: { query: 'gemma 4' } });
  });

  it('tolerates surrounding prose and fences', () => {
    const out = parseAction(
      'Sure, next step:\n```json\n{"' + ACTION_MARKER + '": true, "tool": "finish", "args": {"answer": "done"}}\n```',
    );
    expect(out?.tool).toBe('finish');
    expect(out?.args.answer).toBe('done');
  });

  it('tolerates trailing commas', () => {
    const out = parseAction(`{"${ACTION_MARKER}": true, "tool": "read_core", "args": {"topic": "marathon",},}`);
    expect(out?.tool).toBe('read_core');
  });

  it('handles braces inside arg strings', () => {
    const out = parseAction(`{"${ACTION_MARKER}": true, "tool": "finish", "args": {"answer": "use {x} here"}}`);
    expect(out?.args.answer).toBe('use {x} here');
  });

  it('returns null without the marker', () => {
    expect(parseAction('{"tool": "web_research", "args": {}}')).toBeNull();
    expect(parseAction('just prose')).toBeNull();
  });

  it('returns null for marker without valid JSON', () => {
    expect(parseAction(`${ACTION_MARKER} but no object`)).toBeNull();
  });

  it('drops non-string arg values and caps arg count', () => {
    const args: Record<string, unknown> = { nested: { evil: true }, n: 5, ok: 'yes' };
    for (let i = 0; i < 10; i++) args[`k${i}`] = 'v';
    const out = parseAction(JSON.stringify({ [ACTION_MARKER]: true, tool: 't', args }));
    expect(out).not.toBeNull();
    expect(out!.args.nested).toBeUndefined();
    expect(out!.args.n).toBe('5');
    expect(Object.keys(out!.args).length).toBeLessThanOrEqual(6);
  });

  it('requires a non-empty tool name', () => {
    expect(parseAction(`{"${ACTION_MARKER}": true, "tool": "", "args": {}}`)).toBeNull();
    expect(parseAction(`{"${ACTION_MARKER}": true, "args": {}}`)).toBeNull();
  });
});

describe('looksLikeFinish', () => {
  it('recognizes a truncated finish action that failed to parse', () => {
    const truncated = `{"${ACTION_MARKER}": true, "tool": "finish", "args": {"answer": "here is a very long ans`;
    expect(parseAction(truncated)).toBeNull();
    expect(looksLikeFinish(truncated)).toBe(true);
  });

  it('does not fire on prose or other tools', () => {
    expect(looksLikeFinish('I will finish this soon')).toBe(false);
    expect(looksLikeFinish(`{"tool": "web_research", "args": {"query": "how to finish"}}`)).toBe(false);
  });
});

describe('normalizeKey', () => {
  it('treats retitled equivalents as equal', () => {
    expect(normalizeKey('Study Plan!')).toBe(normalizeKey('study   plan'));
    expect(normalizeKey('Q3 Roadmap — Draft')).toBe(normalizeKey('q3 roadmap draft'));
  });

  it('keeps distinct titles distinct', () => {
    expect(normalizeKey('Study Plan')).not.toBe(normalizeKey('Content Strategy'));
  });
});

describe('actionKey', () => {
  it('is stable across arg order and case', () => {
    expect(actionKey({ tool: 't', args: { a: 'X', b: 'y' } }))
      .toBe(actionKey({ tool: 't', args: { b: 'Y', a: 'x' } }));
  });

  it('differs across tools and args', () => {
    expect(actionKey({ tool: 't', args: { a: '1' } }))
      .not.toBe(actionKey({ tool: 't', args: { a: '2' } }));
  });
});
