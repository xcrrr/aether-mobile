import { AgentKernel, buildReceipt, KernelCallbacks, KernelLlm } from './AgentKernel';
import { runRefine } from './refine';
import { routeGoal } from './router';
import { ToolRegistry, ToolExecutor } from './ToolRegistry';
import { ACTION_MARKER } from './parse';
import { AgentArtifact, AgentTask, TaskContext } from './types';

/**
 * Capability evaluation harness: product-outcome scenarios, not unit internals.
 * Each scenario scripts a model persona (well-behaved E4B, sloppy E2B) against
 * the real kernel + registry and asserts the OUTCOME the user experiences:
 * right route, one deliverable, truthful receipt, clean termination.
 *
 * This is the deterministic regression net for the local-agent product. It
 * cannot prove model quality on-device — that's what the device verification
 * script is for — but it proves the system around the model cannot loop, dupe,
 * overclaim, or bypass consent.
 */

const action = (tool: string, args: Record<string, string> = {}) =>
  JSON.stringify({ [ACTION_MARKER]: true, tool, args });
const finish = () => action('finish');

function ctx(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    conversationId: 'c1', goal: 'test goal', mode: 'balanced',
    modelId: 'gemma4-e4b', attachments: [], ...overrides,
  };
}

function scriptedLlm(script: (string | null)[]): KernelLlm & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    propose: async (prompt: string) => {
      prompts.push(prompt);
      return prompts.length <= script.length ? script[prompts.length - 1] : null;
    },
  };
}

function makeCallbacks(opts: { approve?: boolean; answer?: string | null } = {}): KernelCallbacks & {
  approvals: { tool: string }[];
} {
  const approvals: { tool: string }[] = [];
  return {
    approvals,
    onProgress: () => {},
    onApproval: async (req) => { approvals.push({ tool: req.tool }); return opts.approve ?? true; },
    onAskUser: async () => (opts.answer === undefined ? 'Option A' : opts.answer),
    onState: () => {},
  };
}

const okResearch: ToolExecutor = async () => ({
  ok: true, summary: 'read 2 sources', detail: 'research says X',
  sources: [{ title: 'A', url: 'https://a.example' }, { title: 'B', url: 'https://b.example' }],
});

function registry(executors: Record<string, ToolExecutor> = {}): ToolRegistry {
  return new ToolRegistry({ web_research: okResearch, ...executors });
}

const priorArtifact = (over: Partial<AgentArtifact> = {}): AgentArtifact => ({
  id: 'prior-1', taskId: 'old-task', title: 'Beta Roadmap',
  content: '# Beta Roadmap\n- step one', createdAt: 1, saved: false, ...over,
});

describe('Eval 1 — a simple request never enters task machinery', () => {
  it('smalltalk and simple questions route to plain chat', () => {
    expect(routeGoal('hi', { hasPriorArtifact: false })).toBe('chat');
    expect(routeGoal('what is a closure in JavaScript?', { hasPriorArtifact: false })).toBe('chat');
  });
});

describe('Eval 2 — current-information request uses Research only when permitted', () => {
  it('runs research when allowed and grounds the reply in real sources', async () => {
    const llm = scriptedLlm([
      action('web_research', { query: 'current on-device LLM trends' }),
      finish(),
      'Grounded takeaways from the research.',
    ]);
    const task = await new AgentKernel().runTask(ctx(), registry(), llm, makeCallbacks());
    expect(task.status).toBe('done');
    expect(task.sources).toHaveLength(2);
    expect(buildReceipt(task).sources.map((s) => s.url)).toEqual([
      'https://a.example', 'https://b.example',
    ]);
  });

  it('declined disclosure removes research entirely: hidden from prompts, blocked in code', async () => {
    const research = jest.fn(okResearch);
    const llm = scriptedLlm([
      action('web_research', { query: 'anything' }),
      finish(),
      'Answered from local knowledge only.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ researchAllowed: false }), registry({ web_research: research }), llm, makeCallbacks(),
    );
    expect(research).not.toHaveBeenCalled();
    expect(llm.prompts[0]).not.toContain('web_research (query');
    const blocked = task.steps.find((s) => s.tool === 'web_research');
    expect(blocked?.status).toBe('blocked');
    expect(blocked?.summary).toContain('local-only');
    expect(task.status).toBe('done');
    expect(task.sources).toHaveLength(0);
  });
});

describe('Eval 3 — research plus deliverable: one artifact, real answer, clean end', () => {
  it('completes the full workflow without duplicates', async () => {
    const llm = scriptedLlm([
      action('web_research', { query: 'local AI trends' }),
      action('create_artifact', { title: 'Beta Roadmap', outline: 'trends, milestones, risks' }),
      '# Beta Roadmap\nGrounded content.',
      finish(),
      'I researched current trends and drafted the roadmap — it covers milestones and risks.',
    ]);
    const task = await new AgentKernel().runTask(ctx(), registry(), llm, makeCallbacks());
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].saved).toBe(false);
    expect(task.finalAnswer).toContain('roadmap');
    const receipt = buildReceipt(task);
    expect(receipt.artifacts).toHaveLength(1);
    expect(receipt.status).toBe('done');
  });
});

describe('Eval 4 — a rephrased duplicate becomes completion, not a second artifact', () => {
  it('within one task: guidance first, then kernel-owned completion', async () => {
    const llm = scriptedLlm([
      action('create_artifact', { title: 'Study Plan', outline: 'weekly schedule' }),
      '# Study Plan\nweek 1',
      action('create_artifact', { title: 'study plan!', outline: 'a weekly schedule' }),
      action('create_artifact', { title: 'Study Plan', outline: 'weekly schedule v2' }),
      'The study plan is ready above.',
    ]);
    const task = await new AgentKernel().runTask(ctx(), registry(), llm, makeCallbacks());
    expect(task.artifacts).toHaveLength(1);
    expect(task.status).toBe('done');
  });

  it('across turns: an artifact from earlier in the conversation is never recreated', async () => {
    const llm = scriptedLlm([
      action('create_artifact', { title: 'Beta Roadmap', outline: 'roadmap' }),
      action('create_artifact', { title: 'beta roadmap', outline: 'the roadmap' }),
      'You already have the Beta Roadmap from before.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ priorArtifacts: [priorArtifact()] }), registry(), llm, makeCallbacks(),
    );
    expect(task.artifacts).toHaveLength(0);
    expect(task.status).toBe('done');
    expect(llm.prompts[0]).toContain('from earlier in this conversation already EXISTS');
  });
});

describe('Eval 5 — refinement operates on the existing result', () => {
  it('the refine fast path is one model call on the same document id', async () => {
    const prior = priorArtifact({ saved: true });
    const llm = scriptedLlm(['# Beta Roadmap\nshorter now']);
    const kernel = new AgentKernel();
    const task = await runRefine(
      ctx({ goal: 'make it shorter' }), prior, llm, kernel, () => {}, () => {},
    );
    expect(llm.prompts).toHaveLength(1);
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].id).toBe('prior-1');
    expect(task.artifacts[0].saved).toBe(true);
    expect(task.artifacts[0].content).toContain('shorter now');
    expect(task.finalAnswer).toContain('Updated');
  });

  it('a failed refine claims nothing changed', async () => {
    const task = await runRefine(
      ctx({ goal: 'make it shorter' }), priorArtifact(), scriptedLlm([null]),
      new AgentKernel(), () => {}, () => {},
    );
    expect(task.status).toBe('failed');
    expect(task.artifacts).toHaveLength(0);
    expect(task.finalAnswer).toContain('unchanged');
  });

  it('inside the kernel, revise_artifact can target a prior-conversation artifact', async () => {
    const llm = scriptedLlm([
      action('revise_artifact', { title: 'Beta Roadmap', instruction: 'add risks' }),
      '# Beta Roadmap\nwith risks',
      finish(),
      'Added a risks section to the roadmap.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ priorArtifacts: [priorArtifact()] }), registry(), llm, makeCallbacks(),
    );
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].id).toBe('prior-1');
    expect(task.artifacts[0].content).toContain('with risks');
  });

  it('the router only takes the refine path when a draft actually exists', () => {
    expect(routeGoal('make it shorter', { hasPriorArtifact: true })).toBe('refine');
    expect(routeGoal('make it shorter', { hasPriorArtifact: false })).toBe('task');
  });
});

describe('Eval 6 — one necessary clarification, answered, remembered, completed', () => {
  it('folds the answer into later prompts and finishes', async () => {
    const llm = scriptedLlm([
      action('ask_user', { question: 'Which exam?', options: 'Math|History' }),
      finish(),
      'A study plan focused on the History exam.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx(), registry(), llm, makeCallbacks({ answer: 'History' }),
    );
    expect(task.status).toBe('done');
    expect(llm.prompts[2]).toContain('History');
    expect(task.finalAnswer).toContain('History');
  });
});

describe('Eval 7 — a sloppy small model cannot loop or leak protocol', () => {
  it('repeated malformed output degrades to an honest terminal answer', async () => {
    const llm = scriptedLlm([
      'I think I should search the web maybe?',
      '{"tool": "web_research"',
      'garbage',
      'Here is what I can offer from local knowledge.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ modelId: 'gemma4-e2b' }), registry(), llm, makeCallbacks(),
    );
    expect(task.status).toBe('done');
    expect(task.finalAnswer).toBe('Here is what I can offer from local knowledge.');
    expect(task.finalAnswer).not.toContain(ACTION_MARKER);
  });

  it('a truncated finish still ends the task (looksLikeFinish rescue)', async () => {
    const llm = scriptedLlm([
      `{"${ACTION_MARKER}": true, "tool": "finish", "args": {"answer": "long text that got trunc`,
      'Recovered final answer.',
    ]);
    const task = await new AgentKernel().runTask(ctx({ modelId: 'gemma4-e2b' }), registry(), llm, makeCallbacks());
    expect(task.status).toBe('done');
    expect(task.finalAnswer).toBe('Recovered final answer.');
  });

  it('total model silence fails honestly with zero claimed work', async () => {
    const task = await new AgentKernel().runTask(
      ctx({ modelId: 'gemma4-e2b' }), registry(), scriptedLlm([]), makeCallbacks(),
    );
    expect(task.status).toBe('failed');
    expect(task.artifacts).toHaveLength(0);
    expect(task.finalAnswer).toContain('Nothing was changed');
  });
});

describe('Eval 8 — Ask first (strict) is visible, respected, and decline is honest', () => {
  it('research waits for approval and runs only after it', async () => {
    const cb = makeCallbacks({ approve: true });
    const llm = scriptedLlm([
      action('web_research', { query: 'x' }),
      finish(),
      'done',
    ]);
    const task = await new AgentKernel().runTask(ctx({ mode: 'strict' }), registry(), llm, cb);
    expect(cb.approvals.map((a) => a.tool)).toContain('web_research');
    expect(task.steps[0].status).toBe('executed');
  });

  it('declining records the step as declined and never fakes completion of it', async () => {
    const research = jest.fn(okResearch);
    const cb = makeCallbacks({ approve: false });
    const llm = scriptedLlm([
      action('web_research', { query: 'x' }),
      finish(),
      'I could not research — here is what I know locally.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ mode: 'strict' }), registry({ web_research: research }), llm, cb,
    );
    expect(research).not.toHaveBeenCalled();
    expect(task.steps[0].status).toBe('declined');
    expect(task.sources).toHaveLength(0);
    const receipt = buildReceipt(task);
    expect(receipt.notes).toContain('Declined');
  });
});

describe('Eval 9 — Stop produces an honest partial state', () => {
  it('cancel during a step ends the task as cancelled with no fake answer', async () => {
    const kernel = new AgentKernel();
    const research: ToolExecutor = async () => {
      kernel.cancel();
      return okResearch({}, ctx(), () => {});
    };
    const llm = scriptedLlm([action('web_research', { query: 'x' })]);
    const task = await kernel.runTask(ctx(), registry({ web_research: research }), llm, makeCallbacks());
    expect(task.status).toBe('cancelled');
    expect(task.finalAnswer).toBe('');
    expect(buildReceipt(task).notes).toContain('Stopped by you');
  });
});

describe('Eval 10 — final answers never claim work outside the ledger', () => {
  it('the deterministic fallback says "Updated", not "Created", for a revised prior artifact', async () => {
    const llm = scriptedLlm([
      action('revise_artifact', { title: 'Beta Roadmap', instruction: 'add risks' }),
      '# Beta Roadmap\nwith risks',
      finish(),
      null, // compose call fails → deterministic ledger answer
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ priorArtifacts: [priorArtifact()] }), registry(), llm, makeCallbacks(),
    );
    expect(task.status).toBe('done');
    expect(task.finalAnswer).toContain('Updated **Beta Roadmap**');
    expect(task.finalAnswer).not.toContain('Created');
  });

  it('the deterministic fallback is built only from artifacts/steps that exist', async () => {
    const llm = scriptedLlm([
      action('create_artifact', { title: 'Checklist', outline: 'items' }),
      '# Checklist\n- a',
      finish(),
      null, // compose call fails → deterministic ledger answer
    ]);
    const task = await new AgentKernel().runTask(ctx(), registry(), llm, makeCallbacks());
    expect(task.status).toBe('done');
    expect(task.finalAnswer).toContain('Checklist');
    expect(task.finalAnswer).not.toContain('Researched the web');
    expect(task.finalAnswer).not.toContain('Core notes');
  });
});
