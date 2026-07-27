import { stripSpecialTokens } from '@/llm/prompt';
import {
  budgetsFor, decide, autoSavesArtifacts, MAX_MALFORMED, MAX_RETRIES_PER_TOOL,
} from './PolicyEngine';
import { ToolRegistry } from './ToolRegistry';
import { parseAction, actionKey, looksLikeFinish, normalizeKey } from './parse';
import {
  buildStepPrompt, buildArtifactPrompt, buildRevisePrompt, buildFinalAnswerPrompt,
  scrubUntrusted, gatheredDetailBudget,
} from './prompts';
import {
  AgentArtifact, AgentReceipt, AgentStep, AgentTask, ProposedAction, StepStatus,
  TaskContext, TaskStatus,
} from './types';

/**
 * The Aether Agent Kernel: a bounded task machine, not an autonomous loop.
 *
 * Each iteration: build a compact state prompt → the model proposes ONE action
 * → the PolicyEngine decides (auto / approval / blocked) in deterministic code
 * → execute → normalize + scrub the result → repeat, until a terminal outcome.
 * Every step lands in an append-only ledger; the receipt is built from that
 * ledger and nothing else, so it cannot describe work that did not happen.
 *
 * Completion is kernel-owned: `finish` is a payload-free signal, and every
 * terminal path (finish, budget exhaustion, malformed-finish rescue, repeated
 * duplicate proposals) converges on one composeFinal routine that writes the
 * user-facing reply grounded in the ledger — with a deterministic, code-built
 * fallback when the model cannot. A task that did real work can therefore
 * always end cleanly, and a terminal outcome is terminal.
 */

export interface KernelLlm {
  /** One serialized model call. Null when the engine is unavailable/busy/failed. */
  propose(prompt: string, opts?: { maxTokens?: number }): Promise<string | null>;
}

export interface KernelCallbacks {
  onProgress(status: string): void;
  /** Resolve true to approve, false to decline. Must reject/resolve on cancel. */
  onApproval(req: { tool: string; argsSummary: string; risk: string }): Promise<boolean>;
  /** Resolve with the picked option, or null if the user cancelled the task. */
  onAskUser(q: { question: string; options: string[] }): Promise<string | null>;
  /** Fired at every state transition — persistence + live UI hook. */
  onState(task: AgentTask): void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const PROPOSE_MAX_TOKENS = 220;
const ARTIFACT_MAX_TOKENS = 900;
const ANSWER_MAX_TOKENS = 700;
/** Rolling window of tool detail fed to finish/artifact prompts. */
const MAX_DETAILS = 4;
const ATTACHMENT_DEPENDENCY = /\b(attach(?:ed|ment)?|document|file|pdf|debrief)\b/i;

function argsSummary(a: ProposedAction): string {
  const parts = Object.entries(a.args)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.length > 80 ? `${v.slice(0, 80)}…` : v}`);
  return parts.join(', ');
}

export class AgentKernel {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  async runTask(
    ctx: TaskContext,
    registry: ToolRegistry,
    llm: KernelLlm,
    cb: KernelCallbacks,
  ): Promise<AgentTask> {
    const budgets = budgetsFor(ctx.mode, ctx.modelId);
    const prior = ctx.priorArtifacts ?? [];
    const priorIds = new Set(prior.map((a) => a.id));
    /** Consent is enforced in code: declined disclosure zeroes the research budget. */
    const maxResearch = ctx.researchAllowed === false ? 0 : budgets.maxWebResearch;
    const startedAt = Date.now();
    const task: AgentTask = {
      id: uid(),
      conversationId: ctx.conversationId,
      goal: ctx.goal,
      mode: ctx.mode,
      modelId: ctx.modelId,
      status: 'running',
      startedAt,
      endedAt: null,
      steps: [],
      sources: [],
      artifacts: [],
      finalAnswer: '',
    };
    cb.onState(task);

    let modelCalls = 0;
    let webResearchUsed = 0;
    let malformedStreak = 0;
    let duplicateArtifactAttempts = 0;
    const details: string[] = [];
    const executedKeys = new Set<string>();
    const declinedKeys = new Set<string>();
    const failedKeyCounts = new Map<string, number>();
    /** Normalized outlines of created artifacts — catches "same deliverable, new title". */
    const createdOutlines = new Set<string>();
    const attachmentReadRequired = ctx.attachments.length > 0 && ATTACHMENT_DEPENDENCY.test(ctx.goal);

    const setStatus = (status: TaskStatus) => {
      task.status = status;
      cb.onState(task);
    };

    const record = (tool: string, args: string, decision: AgentStep['decision'], status: StepStatus, summary: string) => {
      task.steps.push({ tool, argsSummary: args, decision, status, summary, at: Date.now() });
      cb.onState(task);
    };

    const pushDetail = (d: string) => {
      if (!d.trim()) return;
      details.push(d);
      if (details.length > MAX_DETAILS) details.shift();
    };

    /** Blocked proposals don't consume the work budget; maxModelCalls stays the hard bound. */
    const productiveSteps = () => task.steps.filter((s) => s.status !== 'blocked').length;

    const meaningfulWork = () =>
      task.artifacts.length > 0 ||
      task.steps.some((s) => s.status === 'executed' && s.tool !== 'finish');

    const finalize = (status: TaskStatus, answer: string): AgentTask => {
      task.status = status;
      task.endedAt = Date.now();
      task.finalAnswer = answer;
      cb.onState(task);
      return task;
    };

    /**
     * Deterministic final reply built purely from the ledger — the guaranteed
     * floor when the model cannot compose one. It can only describe artifacts,
     * sources, and steps that actually exist, so it can never overclaim.
     */
    const deterministicAnswer = (caveat?: string): string => {
      const lines: string[] = [];
      for (const a of task.artifacts) {
        // A prior-conversation artifact in this task was revised, not created.
        const verb = priorIds.has(a.id) ? 'Updated' : 'Created';
        lines.push(`- ${verb} **${a.title}**${a.saved ? ' — saved to your artifacts.' : ' — it’s a draft above; tap Keep to save it.'}`);
      }
      const research = task.steps.filter((s) => s.tool === 'web_research' && s.status === 'executed');
      if (research.length) {
        lines.push(`- Researched the web (${task.sources.length} source${task.sources.length === 1 ? '' : 's'}).`);
      }
      if (task.steps.some((s) => s.tool === 'read_core' && s.status === 'executed')) {
        lines.push('- Checked your Core notes.');
      }
      if (task.steps.some((s) => s.tool === 'read_attachments' && s.status === 'executed')) {
        lines.push('- Read your attached document(s).');
      }
      const parts = [`Here’s what I completed:\n\n${lines.join('\n')}`];
      if (caveat) parts.push(`Note: ${caveat} — some of the goal may be unfinished.`);
      return parts.join('\n\n');
    };

    /**
     * The single terminal routine. Composes a grounded reply via one dedicated
     * model call; degrades to the deterministic ledger answer when real work
     * exists; fails honestly only when there is nothing truthful to deliver.
     */
    const composeFinal = async (via: string, caveat?: string): Promise<AgentTask> => {
      if (this.cancelled) return finalize('cancelled', task.finalAnswer);
      cb.onProgress('Writing the answer');
      let answer: string | null = null;
      // The compose call may exceed the loop budget by one — ending a task
      // must never be starved by the budget that ended it.
      if (modelCalls <= budgets.maxModelCalls + 1) {
        modelCalls++;
        answer = await llm.propose(
          buildFinalAnswerPrompt(ctx, task, details, caveat),
          { maxTokens: ANSWER_MAX_TOKENS },
        );
      }
      if (this.cancelled) return finalize('cancelled', task.finalAnswer);
      const text = answer ? stripSpecialTokens(answer).trim() : '';
      if (text) {
        record('finish', '', 'auto', 'executed', via);
        return finalize('done', text);
      }
      if (meaningfulWork()) {
        record('finish', '', 'auto', 'executed', `${via} (reply composed from the task record)`);
        return finalize('done', deterministicAnswer(caveat));
      }
      record('finish', '', 'auto', 'failed', `${via}; no work was completed and the model could not produce an answer`);
      return finalize('failed', "I couldn't finish this task — the model failed to produce a usable result. Nothing was changed on your device.");
    };

    while (true) {
      if (this.cancelled) return finalize('cancelled', task.finalAnswer);
      if (Date.now() - startedAt > budgets.wallClockMs) return composeFinal('time budget reached', 'the time budget ran out');
      if (productiveSteps() >= budgets.maxSteps) return composeFinal('step budget reached', 'the step budget ran out');
      if (modelCalls >= budgets.maxModelCalls) return composeFinal('model-call budget reached', 'the model-call budget ran out');

      cb.onProgress(task.steps.length ? 'Deciding the next step' : 'Understanding the task');
      const prompt = buildStepPrompt(ctx, registry.list(), task, {
        webResearchLeft: maxResearch - webResearchUsed,
        stepsLeft: budgets.maxSteps - productiveSteps(),
        formatReminder: malformedStreak > 0,
      });
      modelCalls++;
      const raw = await llm.propose(prompt, { maxTokens: PROPOSE_MAX_TOKENS });
      if (this.cancelled) return finalize('cancelled', task.finalAnswer);

      const action = raw ? parseAction(raw) : null;
      if (!action) {
        // A finish intent must never be lost to formatting: the kernel owns
        // the reply, so a mangled finish still ends the task cleanly.
        if (raw && looksLikeFinish(raw)) return composeFinal('final answer delivered');
        malformedStreak++;
        if (malformedStreak > MAX_MALFORMED) return composeFinal('the model kept producing invalid steps', 'the model kept producing invalid steps');
        continue;
      }
      malformedStreak = 0;

      const invalid = registry.validate(action);
      if (invalid) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked', `not allowed: ${invalid}`);
        continue;
      }

      const spec = registry.get(action.tool)!;
      const key = actionKey(action);

      if (
        attachmentReadRequired &&
        !task.steps.some((step) => step.tool === 'read_attachments' && step.status === 'executed') &&
        (action.tool === 'create_artifact' || action.tool === 'revise_artifact' || action.tool === 'finish')
      ) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked',
          'read the attached document(s) before writing or finishing');
        continue;
      }

      // Deterministic duplicate prevention: an equivalent artifact (same
      // normalized title or same normalized outline) is never created twice.
      // First attempt gets guidance; insisting means the model believes the
      // deliverable is done — so the kernel completes the task.
      if (action.tool === 'create_artifact') {
        const titleNorm = normalizeKey(action.args.title);
        const outlineNorm = normalizeKey(action.args.outline);
        const existing = task.artifacts.find((a) => normalizeKey(a.title) === titleNorm)
          ?? prior.find((a) => normalizeKey(a.title) === titleNorm)
          ?? (createdOutlines.has(outlineNorm) ? task.artifacts[task.artifacts.length - 1] : undefined);
        if (existing) {
          duplicateArtifactAttempts++;
          if (duplicateArtifactAttempts > 1) {
            return composeFinal('deliverable already created; task complete');
          }
          record('create_artifact', argsSummary(action), 'blocked', 'blocked',
            `"${existing.title}" already exists — use revise_artifact to change it, or finish`);
          continue;
        }
      }

      if (executedKeys.has(key)) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked',
          'already done — its result is in the steps above; pick a different step or finish');
        continue;
      }
      if (declinedKeys.has(key)) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked',
          'already declined — pick a different step or finish');
        continue;
      }
      if ((failedKeyCounts.get(key) ?? 0) > MAX_RETRIES_PER_TOOL) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked', 'retry limit reached for this step');
        continue;
      }
      if (action.tool === 'web_research' && webResearchUsed >= maxResearch) {
        record(action.tool, argsSummary(action), 'blocked', 'blocked',
          ctx.researchAllowed === false
            ? 'web research is off for this task — the user chose local-only'
            : 'research budget reached');
        continue;
      }

      const decision = decide(ctx.mode, spec.risk);
      if (decision === 'blocked') {
        record(action.tool, argsSummary(action), 'blocked', 'blocked', 'not permitted in this mode');
        continue;
      }
      if (decision === 'approval') {
        setStatus('awaiting_approval');
        const approved = await cb.onApproval({ tool: action.tool, argsSummary: argsSummary(action), risk: spec.risk });
        if (this.cancelled) return finalize('cancelled', task.finalAnswer);
        setStatus('running');
        if (!approved) {
          declinedKeys.add(key);
          record(action.tool, argsSummary(action), 'approval', 'declined', 'the user declined this step');
          continue;
        }
      }

      // Terminal + interactive + composite tools are kernel-handled; the rest execute via the registry.
      if (action.tool === 'finish') {
        return composeFinal('final answer delivered');
      }

      if (action.tool === 'ask_user') {
        const options = action.args.options.split('|').map((o) => o.trim()).filter(Boolean);
        setStatus('awaiting_user');
        const picked = await cb.onAskUser({ question: action.args.question, options });
        if (this.cancelled || picked === null) return finalize('cancelled', task.finalAnswer);
        setStatus('running');
        record('ask_user', action.args.question, decision, 'executed', `the user answered "${picked}" to "${action.args.question}"`);
        pushDetail(`The user was asked "${action.args.question}" and answered: ${picked}`);
        continue;
      }

      if (action.tool === 'create_artifact') {
        cb.onProgress(`Writing "${action.args.title}"`);
        modelCalls++;
        const body = await llm.propose(
          buildArtifactPrompt(ctx, action.args.title, action.args.outline, details),
          { maxTokens: ARTIFACT_MAX_TOKENS },
        );
        if (this.cancelled) return finalize('cancelled', task.finalAnswer);
        const content = body ? stripSpecialTokens(body).trim() : '';
        if (!content) {
          failedKeyCounts.set(key, (failedKeyCounts.get(key) ?? 0) + 1);
          record('create_artifact', argsSummary(action), decision, 'failed', 'the model could not write the artifact');
          continue;
        }
        const artifact: AgentArtifact = {
          id: uid(), taskId: task.id, title: action.args.title.trim(),
          content, createdAt: Date.now(), saved: autoSavesArtifacts(ctx.mode),
        };
        task.artifacts.push(artifact);
        executedKeys.add(key);
        createdOutlines.add(normalizeKey(action.args.outline));
        record('create_artifact', argsSummary(action), decision, 'executed',
          `created "${artifact.title}" (${content.length} chars)${artifact.saved ? ', saved to workspace' : ' as a draft'}`);
        pushDetail(`Artifact "${artifact.title}" was created with this content:\n${content}`);
        continue;
      }

      if (action.tool === 'revise_artifact') {
        const titleNorm = normalizeKey(action.args.title);
        const target = task.artifacts.find((a) => normalizeKey(a.title) === titleNorm)
          ?? prior.find((a) => normalizeKey(a.title) === titleNorm)
          ?? (task.artifacts.length === 1 ? task.artifacts[0]
            : !task.artifacts.length && prior.length === 1 ? prior[0]
            : undefined);
        if (!target) {
          failedKeyCounts.set(key, (failedKeyCounts.get(key) ?? 0) + 1);
          record('revise_artifact', argsSummary(action), decision, 'failed',
            'no artifact with that title exists yet — create_artifact first');
          continue;
        }
        cb.onProgress(`Revising "${target.title}"`);
        modelCalls++;
        const body = await llm.propose(
          buildRevisePrompt(ctx, target.title, target.content, action.args.instruction, details),
          { maxTokens: ARTIFACT_MAX_TOKENS },
        );
        if (this.cancelled) return finalize('cancelled', task.finalAnswer);
        const content = body ? stripSpecialTokens(body).trim() : '';
        if (!content) {
          failedKeyCounts.set(key, (failedKeyCounts.get(key) ?? 0) + 1);
          record('revise_artifact', argsSummary(action), decision, 'failed', 'the model could not revise the artifact');
          continue;
        }
        if (task.artifacts.includes(target)) {
          target.content = content;
        } else {
          // A prior-conversation artifact keeps its identity (id, saved state);
          // the revised copy joins this task so persistence and receipts see it.
          task.artifacts.push({ ...target, content, taskId: task.id });
        }
        executedKeys.add(key);
        record('revise_artifact', argsSummary(action), decision, 'executed',
          `revised "${target.title}" (${content.length} chars)`);
        pushDetail(`Artifact "${target.title}" now contains:\n${content}`);
        continue;
      }

      cb.onProgress(
        action.tool === 'web_research' ? 'Researching the web'
        : action.tool === 'read_core' ? 'Checking your Core'
        : 'Reading attachments',
      );
      if (action.tool === 'web_research') webResearchUsed++;
      const result = await registry.execute(action, ctx, cb.onProgress);
      if (this.cancelled) return finalize('cancelled', task.finalAnswer);

      if (result.ok) {
        executedKeys.add(key);
        if (result.sources) {
          for (const s of result.sources) {
            if (!task.sources.some((x) => x.url === s.url)) task.sources.push(s);
          }
        }
        record(action.tool, argsSummary(action), decision, 'executed', result.summary);
        pushDetail(scrubUntrusted(result.detail, gatheredDetailBudget()));
      } else {
        failedKeyCounts.set(key, (failedKeyCounts.get(key) ?? 0) + 1);
        record(action.tool, argsSummary(action), decision, 'failed', result.summary);
      }
    }
  }
}

/** The receipt is a pure projection of the ledger — no synthesis, no model. */
export function buildReceipt(task: AgentTask): AgentReceipt {
  const notes: string[] = [];
  if (task.status === 'cancelled') notes.push('Stopped by you; later steps did not run.');
  if (task.status === 'interrupted') notes.push('The app was interrupted while this task ran; steps listed are the only ones that happened.');
  if (task.steps.some((s) => s.status === 'declined')) notes.push('Declined steps were skipped, not retried.');
  if (task.steps.some((s) => s.status === 'failed')) notes.push('Failed steps are listed as failed; their results were not used.');
  return {
    goal: task.goal,
    mode: task.mode,
    status: task.status,
    startedAt: task.startedAt,
    endedAt: task.endedAt ?? Date.now(),
    steps: task.steps,
    sources: task.sources,
    artifacts: task.artifacts.map((a) => ({ id: a.id, title: a.title, saved: a.saved })),
    ...(notes.length ? { notes: notes.join(' ') } : {}),
  };
}
