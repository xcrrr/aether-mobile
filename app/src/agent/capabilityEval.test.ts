import { AgentKernel, buildReceipt, KernelCallbacks, KernelLlm } from './AgentKernel';
import { runRefine } from './refine';
import { routeGoal } from './router';
import { ToolRegistry, ToolExecutor } from './ToolRegistry';
import { ACTION_MARKER } from './parse';
import { AgentArtifact, AgentTask, TaskContext } from './types';
import { buildConversationContext, buildTaskAttachments } from './context';
import { createExecutors } from './tools';
import { Message } from '@/types';
import { MemoryStore } from '@/secondbrain/MemoryStore';

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

const message = (id: string, role: Message['role'], content: string): Message => ({
  id, role, content, createdAt: Number(id.slice(1)),
});

const attachmentMessage = (id: string, content: string, name: string, text: string): Message => ({
  ...message(id, 'user', content),
  attachments: [{
    id: `attachment-${id}`,
    uri: `file:///${name}`,
    name,
    type: 'text',
    mimeType: 'text/plain',
    sizeBytes: text.length,
    extractedText: text,
  }],
});

describe('Eval 1 — a simple request never enters task machinery', () => {
  it('smalltalk and simple questions route to plain chat', () => {
    expect(routeGoal('hi', { hasPriorArtifact: false })).toBe('chat');
    expect(routeGoal('what is a closure in JavaScript?', { hasPriorArtifact: false })).toBe('chat');
  });

  it('an image-dependent Task falls back to multimodal chat instead of a text-only kernel', () => {
    expect(routeGoal(
      'Analyze this attached image and explain the main visual risk.',
      { hasPriorArtifact: false, hasImageAttachment: true },
    )).toBe('chat');
  });
});

describe('Eval 2 — a conversational offline planning request completes as useful work', () => {
  it('routes past the thanks preface, stays local, and returns one plan with a truthful receipt', async () => {
    const goal = 'Thanks! Plan tomorrow around two meetings and a workout.';
    expect(routeGoal(goal, { hasPriorArtifact: false })).toBe('task');

    const llm = scriptedLlm([
      action('create_artifact', {
        title: 'Tomorrow Plan',
        outline: 'a flexible schedule for two meetings, focused work, breaks, and a workout',
      }),
      '# Tomorrow Plan\n\n- Before the first meeting: choose one priority.\n- Between meetings: focused work and a break.\n- After meetings: workout, then a short review.',
      finish(),
      'I made a flexible plan for tomorrow that fits focused work and a workout around both meetings.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ goal, researchAllowed: false }), registry(), llm, makeCallbacks(),
    );

    expect(llm.prompts[0]).not.toContain('web_research (query');
    expect(task.status).toBe('done');
    expect(task.sources).toHaveLength(0);
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].title).toBe('Tomorrow Plan');
    expect(task.artifacts[0].content).toContain('workout');
    expect(task.finalAnswer).toContain('plan for tomorrow');
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });
});

describe('Eval 3 — a contextual offline comparison produces a grounded recommendation', () => {
  it('keeps a short referential follow-up in Actions and uses the earlier tradeoffs', async () => {
    const history = [
      message('m1', 'user', 'I am choosing between Cedar, which works fully offline with manual folders, and Harbor, which automatically organizes notes in the cloud but requires an account.'),
      message('m2', 'assistant', 'Cedar favors local control and manual organization; Harbor favors cloud convenience.'),
      message('m3', 'user', 'Privacy and no-account access matter more to me than automatic organization.'),
      message('m4', 'assistant', 'That makes the privacy and account tradeoff the deciding factor.'),
    ];
    const goal = 'Which is the better fit for me, and why?';
    const conversationContext = buildConversationContext(history);

    expect(routeGoal(goal, {
      hasPriorArtifact: false,
      hasConversationContext: !!conversationContext,
    })).toBe('task');

    const llm = scriptedLlm([
      action('create_artifact', {
        title: 'Setup Recommendation',
        outline: 'compare Cedar and Harbor, then recommend one using the user priorities from this conversation',
      }),
      '# Setup Recommendation\n\nCedar is the better fit because it stays offline and requires no account. Harbor offers easier organization, but its cloud account conflicts with the stated priorities.',
      finish(),
      'Cedar is the better fit: it preserves offline, no-account use, while Harbor trades those priorities for automatic organization.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ goal, conversationContext, researchAllowed: false }),
      registry(),
      llm,
      makeCallbacks(),
    );

    expect(llm.prompts[0]).toContain('Cedar, which works fully offline');
    expect(llm.prompts[0]).toContain('Harbor, which automatically organizes notes');
    expect(llm.prompts[0]).toContain('Privacy and no-account access matter more');
    expect(llm.prompts[0]).not.toContain('web_research (query');
    expect(task.status).toBe('done');
    expect(task.sources).toHaveLength(0);
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].content).toContain('Cedar is the better fit');
    expect(task.finalAnswer).toContain('offline, no-account use');
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });
});

describe('Eval 4 — an attached debrief becomes grounded meeting notes', () => {
  it('carries decisions near the end of the document into the artifact prompt and receipt', async () => {
    const goal = 'Turn the attached project debrief into concise meeting notes with decisions and owners.';
    const debrief = [
      '# Project Lantern debrief',
      'Context: the team reviewed a fictional offline reading-list prototype.',
      `Discussion notes: ${'Routine status detail. '.repeat(75)}`,
      'Decision: keep the launch review weekly until the import flow is stable.',
      'Owner: Morgan will prepare the import checklist before the next review.',
    ].join('\n\n');
    const userMessage = attachmentMessage(
      'm1', goal, 'project-lantern-debrief.txt', debrief,
    );
    const attachments = buildTaskAttachments([userMessage]);

    expect(routeGoal(goal, { hasPriorArtifact: false })).toBe('task');
    expect(attachments).toEqual([{ name: 'project-lantern-debrief.txt', text: debrief }]);

    const llm = scriptedLlm([
      action('read_attachments'),
      action('create_artifact', {
        title: 'Project Lantern Meeting Notes',
        outline: 'a concise summary with the documented decision and owner action',
      }),
      '# Project Lantern Meeting Notes\n\n## Decision\n- Keep the launch review weekly until the import flow is stable.\n\n## Owner\n- Morgan: prepare the import checklist before the next review.',
      finish(),
      'I turned the debrief into concise notes with the weekly review decision and Morgan’s checklist action.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({
        goal,
        researchAllowed: false,
        attachments,
      }),
      new ToolRegistry(createExecutors()),
      llm,
      makeCallbacks(),
    );

    const artifactPrompt = llm.prompts[2];
    expect(artifactPrompt).toContain('keep the launch review weekly');
    expect(artifactPrompt).toContain('Morgan will prepare the import checklist');
    expect(artifactPrompt).not.toContain('web_research (query');
    expect(task.status).toBe('done');
    expect(task.sources).toHaveLength(0);
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].content).toContain('Morgan: prepare the import checklist');
    expect(task.finalAnswer).toContain('weekly review decision');
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['read_attachments', 'executed'],
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });

  it('blocks a small model from writing or finishing before the required document read', async () => {
    const goal = 'Create meeting notes from this attached project debrief.';
    const debrief = [
      '# Fictional project debrief',
      'Decision: keep the local import flow for the beta.',
      'Owner: Taylor will verify the import checklist.',
    ].join('\n\n');
    const prompts: string[] = [];
    const stepActions = [
      action('create_artifact', {
        title: 'Project Debrief Notes',
        outline: 'the document decision and owner',
      }),
      finish(),
      action('read_attachments'),
      action('create_artifact', {
        title: 'Project Debrief Notes',
        outline: 'the document decision and owner',
      }),
      finish(),
    ];
    let stepIndex = 0;
    const llm: KernelLlm & { prompts: string[] } = {
      prompts,
      propose: async (prompt) => {
        prompts.push(prompt);
        if (prompt.startsWith('Write the full markdown content')) {
          return '# Project Debrief Notes\n\n- Keep the local import flow.\n- Taylor: verify the import checklist.';
        }
        if (prompt.startsWith("Write Aether's final reply")) {
          return 'I created grounded debrief notes with the import decision and Taylor’s action.';
        }
        return stepActions[stepIndex++] ?? finish();
      },
    };
    const task = await new AgentKernel().runTask(
      ctx({
        goal,
        researchAllowed: false,
        attachments: [{ name: 'project-debrief.txt', text: debrief }],
      }),
      new ToolRegistry(createExecutors()),
      llm,
      makeCallbacks(),
    );

    expect(task.steps.map((step) => [step.tool, step.status])).toEqual([
      ['create_artifact', 'blocked'],
      ['finish', 'blocked'],
      ['read_attachments', 'executed'],
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
    const artifactPrompt = prompts.find((prompt) => prompt.startsWith('Write the full markdown content'))!;
    expect(artifactPrompt).toContain('keep the local import flow for the beta');
    expect(artifactPrompt).toContain('Taylor will verify the import checklist');
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(task.finalAnswer).toContain('grounded debrief notes');
  });
});

describe('Eval 5 — a newly attached document is the current Task scope', () => {
  it('does not let an older conversation attachment displace the new debrief', async () => {
    const olderDocument = [
      '# Earlier planning notes',
      `Archived detail: ${'Older planning context. '.repeat(120)}`,
    ].join('\n\n');
    const currentDocument = [
      '# Current launch debrief',
      `Discussion: ${'Current review detail. '.repeat(16)}`,
      'Decision: pause the fictional pilot until the accessibility review is complete.',
      'Owner: Riley will schedule the accessibility review.',
    ].join('\n\n');
    const goal = 'Summarize this attached launch debrief into decisions and owner actions.';
    const history = [
      attachmentMessage('m1', 'Summarize the attached planning notes.', 'earlier-planning.txt', olderDocument),
      message('m2', 'assistant', 'The earlier planning summary is complete.'),
      attachmentMessage('m3', goal, 'current-launch-debrief.txt', currentDocument),
    ];
    const attachments = buildTaskAttachments(history, goal);

    expect(attachments).toEqual([{ name: 'current-launch-debrief.txt', text: currentDocument }]);
    expect(buildTaskAttachments(history, 'Compare this with the earlier document.')).toHaveLength(2);

    const llm = scriptedLlm([
      action('read_attachments'),
      action('create_artifact', {
        title: 'Current Launch Debrief',
        outline: 'the current document decision and owner action only',
      }),
      '# Current Launch Debrief\n\n- Decision: pause the pilot pending accessibility review.\n- Owner: Riley will schedule the review.',
      finish(),
      'I summarized the current launch debrief with its accessibility decision and owner action.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ goal, attachments, researchAllowed: false }),
      new ToolRegistry(createExecutors()),
      llm,
      makeCallbacks(),
    );

    expect(llm.prompts[2]).toContain('pause the fictional pilot');
    expect(llm.prompts[2]).toContain('Riley will schedule');
    expect(llm.prompts[2]).not.toContain('Earlier planning notes');
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['read_attachments', 'executed'],
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });
});

describe('Eval 6 — an explicit two-document comparison sees both attachments', () => {
  it('carries substantive data from the earlier and current documents into the artifact', async () => {
    const earlierDocument = [
      '# Earlier pilot proposal',
      'Approach: start the fictional pilot immediately with manual accessibility checks.',
      `Supporting notes: ${'Earlier proposal detail. '.repeat(120)}`,
    ].join('\n\n');
    const currentDocument = [
      '# Current pilot review',
      `Review notes: ${'Current review detail. '.repeat(16)}`,
      'Decision: delay the pilot until the automated accessibility audit is complete.',
      'Owner: Casey will deliver the audit report.',
    ].join('\n\n');
    const goal = 'Compare this attachment with the earlier document and create a decision brief.';
    const history = [
      attachmentMessage('m1', 'Summarize this proposal.', 'earlier-proposal.txt', earlierDocument),
      message('m2', 'assistant', 'The earlier proposal is summarized.'),
      attachmentMessage('m3', goal, 'current-review.txt', currentDocument),
    ];
    const attachments = buildTaskAttachments(history, goal);

    expect(attachments).toHaveLength(2);

    const llm = scriptedLlm([
      action('read_attachments'),
      action('create_artifact', {
        title: 'Pilot Decision Brief',
        outline: 'compare the earlier immediate pilot with the current delay decision and owner',
      }),
      '# Pilot Decision Brief\n\nThe earlier proposal starts immediately with manual checks. The current review delays the pilot for an automated accessibility audit, owned by Casey.',
      finish(),
      'I compared both documents and drafted the decision brief with the changed timing and audit owner.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ goal, attachments, researchAllowed: false }),
      new ToolRegistry(createExecutors()),
      llm,
      makeCallbacks(),
    );

    const artifactPrompt = llm.prompts[2];
    expect(artifactPrompt).toContain('start the fictional pilot immediately');
    expect(artifactPrompt).toContain('delay the pilot until the automated accessibility audit');
    expect(artifactPrompt).toContain('Casey will deliver the audit report');
    expect(task.status).toBe('done');
    expect(task.artifacts[0].content).toContain('owned by Casey');
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['read_attachments', 'executed'],
      ['create_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });
});

describe('Eval 7 — a Core-aware plan uses the saved goals and preferences', () => {
  it('resolves a broad Core topic into relevant saved context before writing', async () => {
    MemoryStore.resetLocalState();
    MemoryStore.addOrUpdateEntry({
      category: 'goals',
      key: 'aurora_certification_target',
      value: 'Complete the fictional Aurora certification by October.',
      confidence: 1,
      sourceConversationId: 'fixture-goal',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences',
      key: 'focused_study_time',
      value: 'Quiet mornings are best for focused study.',
      confidence: 1,
      sourceConversationId: 'fixture-preference',
    });

    try {
      const goal = 'Use what Core remembers about my goals and preferences to create a realistic weekly plan.';
      const llm = scriptedLlm([
        action('read_core', { topic: 'goals and preferences' }),
        action('create_artifact', {
          title: 'Aurora Weekly Plan',
          outline: 'a weekly plan grounded in the saved certification target and preferred study time',
        }),
        '# Aurora Weekly Plan\n\n- Quiet mornings: focused Aurora certification study.\n- Friday: review progress toward the October target.',
        finish(),
        'I created a weekly plan around quiet-morning study and the October Aurora certification target saved in Core.',
      ]);
      const task = await new AgentKernel().runTask(
        ctx({ goal, researchAllowed: false }),
        new ToolRegistry(createExecutors()),
        llm,
        makeCallbacks(),
      );

      const artifactPrompt = llm.prompts[2];
      expect(artifactPrompt).toContain('Complete the fictional Aurora certification by October');
      expect(artifactPrompt).toContain('Quiet mornings are best for focused study');
      expect(artifactPrompt).not.toContain('web_research (query');
      expect(task.status).toBe('done');
      expect(task.artifacts[0].content).toContain('October target');
      expect(task.finalAnswer).toContain('saved in Core');
      expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
        ['read_core', 'executed'],
        ['create_artifact', 'executed'],
        ['finish', 'executed'],
      ]);
    } finally {
      MemoryStore.resetLocalState();
    }
  });
});

describe('Eval 8 — current-information request uses Research only when permitted', () => {
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

describe('Eval 9 — research plus deliverable: one artifact, real answer, clean end', () => {
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

describe('Eval 10 — a rephrased duplicate becomes completion, not a second artifact', () => {
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

describe('Eval 11 — refinement operates on the existing result', () => {
  it('reads a referenced attachment before revising the same existing artifact', async () => {
    const prior = priorArtifact({ saved: true });
    const goal = 'Update the roadmap using this attached project debrief.';
    const debrief = [
      '# Project debrief',
      'Confirmed change: move the fictional beta review to Thursday.',
      'Risk: the import checklist still needs an owner.',
    ].join('\n\n');
    const history = [attachmentMessage('m1', goal, 'project-debrief.txt', debrief)];
    const attachments = buildTaskAttachments(history, goal);

    expect(routeGoal(goal, {
      hasPriorArtifact: true,
      hasConversationContext: true,
      hasAttachments: true,
    })).toBe('task');

    const llm = scriptedLlm([
      action('read_attachments'),
      action('revise_artifact', {
        title: 'Beta Roadmap',
        instruction: 'apply the confirmed review date and add the unresolved owner risk',
      }),
      '# Beta Roadmap\n\n- Beta review: Thursday.\n- Risk: assign an owner for the import checklist.',
      finish(),
      'I updated the existing roadmap with Thursday’s review and the unresolved checklist-owner risk.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ goal, attachments, priorArtifacts: [prior], researchAllowed: false }),
      new ToolRegistry(createExecutors()),
      llm,
      makeCallbacks(),
    );

    expect(llm.prompts[2]).toContain('move the fictional beta review to Thursday');
    expect(llm.prompts[2]).toContain('import checklist still needs an owner');
    expect(task.status).toBe('done');
    expect(task.artifacts).toHaveLength(1);
    expect(task.artifacts[0].id).toBe(prior.id);
    expect(task.artifacts[0].saved).toBe(true);
    expect(task.artifacts[0].content).toContain('Beta review: Thursday');
    expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
      ['read_attachments', 'executed'],
      ['revise_artifact', 'executed'],
      ['finish', 'executed'],
    ]);
  });

  it('reads explicitly requested Core context before revising the same artifact', async () => {
    MemoryStore.resetLocalState();
    MemoryStore.addOrUpdateEntry({
      category: 'goals',
      key: 'orion_release_target',
      value: 'Prepare the fictional Orion beta by November.',
      confidence: 1,
      sourceConversationId: 'fixture-goal',
    });
    MemoryStore.addOrUpdateEntry({
      category: 'preferences',
      key: 'planning_style',
      value: 'Prefers weekly milestones with one clear owner.',
      confidence: 1,
      sourceConversationId: 'fixture-preference',
    });

    try {
      const prior = priorArtifact({ saved: true });
      const goal = 'Update the roadmap using what Core remembers about my goals and preferences.';
      expect(routeGoal(goal, { hasPriorArtifact: true })).toBe('task');

      const llm = scriptedLlm([
        action('read_core', { topic: 'goals and preferences' }),
        action('revise_artifact', {
          title: 'Beta Roadmap',
          instruction: 'align the roadmap with the saved release target and planning preference',
        }),
        '# Beta Roadmap\n\n- Weekly owned milestones toward the November Orion beta.',
        finish(),
        'I updated the same roadmap with weekly owners and the November Orion beta target from Core.',
      ]);
      const task = await new AgentKernel().runTask(
        ctx({ goal, priorArtifacts: [prior], researchAllowed: false }),
        new ToolRegistry(createExecutors()),
        llm,
        makeCallbacks(),
      );

      expect(llm.prompts[2]).toContain('Prepare the fictional Orion beta by November');
      expect(llm.prompts[2]).toContain('Prefers weekly milestones with one clear owner');
      expect(task.status).toBe('done');
      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts[0].id).toBe(prior.id);
      expect(task.artifacts[0].saved).toBe(true);
      expect(buildReceipt(task).steps.map((step) => [step.tool, step.status])).toEqual([
        ['read_core', 'executed'],
        ['revise_artifact', 'executed'],
        ['finish', 'executed'],
      ]);
    } finally {
      MemoryStore.resetLocalState();
    }
  });

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

describe('Eval 12 — one necessary clarification, answered, remembered, completed', () => {
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

describe('Eval 13 — a sloppy small model cannot loop or leak protocol', () => {
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

describe('Eval 14 — Ask first (strict) is visible, respected, and decline is honest', () => {
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

  it('one decline is final when a small model repeats the identical step', async () => {
    const research = jest.fn(okResearch);
    const cb = makeCallbacks({ approve: false });
    const repeated = action('web_research', { query: 'fictional beta benchmarks' });
    const llm = scriptedLlm([
      repeated,
      repeated,
      finish(),
      'I kept this local after you declined research.',
    ]);
    const task = await new AgentKernel().runTask(
      ctx({ mode: 'strict', modelId: 'gemma4-e2b' }),
      registry({ web_research: research }),
      llm,
      cb,
    );

    expect(cb.approvals).toEqual([{ tool: 'web_research' }]);
    expect(research).not.toHaveBeenCalled();
    expect(task.steps.map((step) => [step.tool, step.status])).toEqual([
      ['web_research', 'declined'],
      ['web_research', 'blocked'],
      ['finish', 'executed'],
    ]);
    expect(buildReceipt(task).notes).toContain('Declined steps were skipped, not retried.');
  });
});

describe('Eval 15 — Stop produces an honest partial state', () => {
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

describe('Eval 16 — final answers never claim work outside the ledger', () => {
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
