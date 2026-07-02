import { stripSpecialTokens } from '@/llm/prompt';
import { AgentKernel, KernelLlm } from './AgentKernel';
import { buildRevisePrompt } from './prompts';
import { AgentArtifact, AgentTask, TaskContext } from './types';

/**
 * The refinement fast path. A follow-up like "make it shorter" is ONE revise
 * call on the existing artifact — same document id, same saved state, no
 * planning loop, no duplicate. Only used outside strict mode (strict routes
 * through the kernel so the approval matrix stays in charge of every write).
 *
 * The result is a normal AgentTask record: the ledger has exactly one step,
 * the receipt is a truthful projection of it, and failure or cancellation can
 * never claim the draft changed.
 */

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const REVISE_MAX_TOKENS = 900;

export async function runRefine(
  ctx: TaskContext,
  target: AgentArtifact,
  llm: KernelLlm,
  kernel: AgentKernel,
  onState: (task: AgentTask) => void,
  onProgress: (status: string) => void,
): Promise<AgentTask> {
  const task: AgentTask = {
    id: uid(),
    conversationId: ctx.conversationId,
    goal: ctx.goal,
    mode: ctx.mode,
    modelId: ctx.modelId,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    steps: [],
    sources: [],
    artifacts: [],
    finalAnswer: '',
  };
  onState(task);
  onProgress(`Updating "${target.title}"`);

  const finalize = (status: AgentTask['status'], answer: string): AgentTask => {
    task.status = status;
    task.endedAt = Date.now();
    task.finalAnswer = answer;
    onState(task);
    return task;
  };

  const body = await llm.propose(
    buildRevisePrompt(ctx, target.title, target.content, ctx.goal, []),
    { maxTokens: REVISE_MAX_TOKENS },
  );
  if (kernel.isCancelled()) return finalize('cancelled', '');

  const content = body ? stripSpecialTokens(body).trim() : '';
  if (!content) {
    task.steps.push({
      tool: 'revise_artifact',
      argsSummary: `title: ${target.title}`,
      decision: 'auto',
      status: 'failed',
      summary: 'the model could not apply the change',
      at: Date.now(),
    });
    return finalize('failed', `I couldn't apply that change to **${target.title}** — the draft is unchanged.`);
  }

  task.artifacts.push({ ...target, content, taskId: task.id });
  task.steps.push({
    tool: 'revise_artifact',
    argsSummary: `title: ${target.title}, instruction: ${ctx.goal.slice(0, 80)}`,
    decision: 'auto',
    status: 'executed',
    summary: `revised "${target.title}" (${content.length} chars)`,
    at: Date.now(),
  });
  return finalize('done',
    `Updated **${target.title}**${target.saved ? ' — the saved copy reflects the change.' : ' — it’s the draft above; tap Keep to save it.'}`);
}
