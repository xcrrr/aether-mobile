import { ToolRegistry } from './ToolRegistry';
import { TaskContext } from './types';

const ctx: TaskContext = {
  conversationId: 'c1', goal: 'g', mode: 'balanced', modelId: 'gemma4-e4b', attachments: [],
};

describe('ToolRegistry', () => {
  it('rejects unknown tools', () => {
    const r = new ToolRegistry({});
    expect(r.validate({ tool: 'run_shell', args: {} })).toMatch(/unknown tool/);
    expect(r.validate({ tool: 'grant_permission', args: { scope: 'all' } })).toMatch(/unknown tool/);
  });

  it('rejects executors registered for names outside the spec set', async () => {
    const evil = jest.fn();
    const r = new ToolRegistry({ delete_files: evil } as never);
    const res = await r.execute({ tool: 'delete_files', args: {} }, ctx, () => {});
    expect(res.ok).toBe(false);
    expect(evil).not.toHaveBeenCalled();
  });

  it('validates required args', () => {
    const r = new ToolRegistry({});
    expect(r.validate({ tool: 'web_research', args: {} })).toMatch(/query/);
    expect(r.validate({ tool: 'web_research', args: { query: '  ' } })).toMatch(/query/);
    expect(r.validate({ tool: 'web_research', args: { query: 'ok' } })).toBeNull();
    expect(r.validate({ tool: 'web_research', args: { query: 'x'.repeat(400) } })).toMatch(/too long/);
  });

  it('strips args the spec does not declare', () => {
    const r = new ToolRegistry({});
    const action = { tool: 'read_core', args: { topic: 'plans', path: '/etc/passwd' } };
    expect(r.validate(action)).toBeNull();
    expect(action.args.path).toBeUndefined();
  });

  it('finish never fails validation — completion cannot be blocked on formatting', () => {
    const r = new ToolRegistry({});
    expect(r.validate({ tool: 'finish', args: {} })).toBeNull();
    expect(r.validate({ tool: 'finish', args: { answer: 'stray payload' } })).toBeNull();
  });

  it('validates revise_artifact args', () => {
    const r = new ToolRegistry({});
    expect(r.validate({ tool: 'revise_artifact', args: { title: 'Plan' } })).toMatch(/instruction/);
    expect(r.validate({ tool: 'revise_artifact', args: { instruction: 'expand' } })).toMatch(/title/);
    expect(r.validate({ tool: 'revise_artifact', args: { title: 'Plan', instruction: 'expand' } })).toBeNull();
  });

  it('validates ask_user option counts', () => {
    const r = new ToolRegistry({});
    expect(r.validate({ tool: 'ask_user', args: { question: 'q', options: 'one' } })).toMatch(/options/);
    expect(r.validate({ tool: 'ask_user', args: { question: 'q', options: 'a|b|c|d|e' } })).toMatch(/options/);
    expect(r.validate({ tool: 'ask_user', args: { question: 'q', options: 'a|b' } })).toBeNull();
  });

  it('normalizes executor throws into failed results', async () => {
    const r = new ToolRegistry({
      web_research: async () => { throw new Error('network down'); },
    });
    const res = await r.execute({ tool: 'web_research', args: { query: 'x' } }, ctx, () => {});
    expect(res.ok).toBe(false);
    expect(res.summary).toMatch(/network down/);
  });
});
