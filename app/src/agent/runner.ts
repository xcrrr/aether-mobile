import { AgentKernel, KernelLlm, buildReceipt } from './AgentKernel';
import { ToolRegistry } from './ToolRegistry';
import { createExecutors } from './tools';
import { runRefine } from './refine';
import { saveTask, saveArtifact, markInterruptedTasks } from './taskStorage';
import { AgentArtifact, AgentReceipt, AgentTask, TaskContext } from './types';
import { useAgentStore } from '@/state/useAgentStore';

/**
 * Glue between the pure kernel and the app: the real LiteRT model call, the
 * real tool executors, persistence at every transition, and the UI store for
 * progress / approvals / questions. One agent task runs at a time — the model
 * calls ride the same serialized `extract(preempt)` path research uses, so an
 * agent step can never overlap a chat reply.
 */

const STEP_TEMPERATURE = 0.2;

const llm: KernelLlm = {
  propose: async (prompt, opts) => {
    const Llama = require('@/llm/engine') as typeof import('@/llm/engine');
    return Llama.extract(prompt, {
      maxTokens: opts?.maxTokens ?? 256,
      temperature: STEP_TEMPERATURE,
      preempt: true,
      label: 'task',
    });
  },
};

let recoveryDone = false;

export async function runAgentTask(ctx: TaskContext): Promise<{ task: AgentTask; receipt: AgentReceipt }> {
  if (!recoveryDone) {
    recoveryDone = true;
    await markInterruptedTasks();
  }

  const store = useAgentStore.getState();
  const kernel = new AgentKernel();
  store.beginRun(kernel);

  // Persistence is best-effort and serialized; a storage hiccup must never
  // kill a running task, only the audit copy of one transition.
  let pendingSave = Promise.resolve();
  const persistState = (task: AgentTask) => {
    useAgentStore.getState().setLiveTask(task);
    pendingSave = pendingSave.then(() => saveTask(task)).catch(() => {});
  };

  try {
    const task = await kernel.runTask(ctx, new ToolRegistry(createExecutors()), llm, {
      onProgress: (p) => useAgentStore.getState().setProgress(p),
      onApproval: (req) => useAgentStore.getState().requestApproval(req),
      onAskUser: (q) => useAgentStore.getState().requestQuestion(q),
      onState: persistState,
    });
    for (const artifact of task.artifacts) {
      if (artifact.saved) await saveArtifact(artifact);
    }
    await pendingSave;
    await saveTask(task);
    return { task, receipt: buildReceipt(task) };
  } finally {
    useAgentStore.getState().endRun();
  }
}

/**
 * The refinement fast path: one revise call on an existing artifact. Same
 * persistence and live-UI contract as a full task, without the planning loop.
 */
export async function runRefineTask(
  ctx: TaskContext,
  target: AgentArtifact,
): Promise<{ task: AgentTask; receipt: AgentReceipt }> {
  if (!recoveryDone) {
    recoveryDone = true;
    await markInterruptedTasks();
  }
  const store = useAgentStore.getState();
  const kernel = new AgentKernel();
  store.beginRun(kernel);
  try {
    const task = await runRefine(
      ctx, target, llm, kernel,
      (t) => { useAgentStore.getState().setLiveTask(t); void saveTask(t).catch(() => {}); },
      (p) => useAgentStore.getState().setProgress(p),
    );
    for (const artifact of task.artifacts) {
      if (artifact.saved) await saveArtifact(artifact);
    }
    await saveTask(task);
    return { task, receipt: buildReceipt(task) };
  } finally {
    useAgentStore.getState().endRun();
  }
}
