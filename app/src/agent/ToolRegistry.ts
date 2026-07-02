import { ProposedAction, TaskContext, ToolResult, ToolSpec } from './types';

/**
 * The closed set of tools an agent task can ever touch. Specs (name, risk
 * class, arg schema) are static and code-defined; executors are injected so
 * the kernel is testable and the registry itself never imports the engine.
 * A proposal naming anything outside this set is blocked by construction.
 */

const nonEmpty = (v: string | undefined, label: string, max: number): string | null => {
  if (!v || !v.trim()) return `${label} is required`;
  if (v.length > max) return `${label} too long`;
  return null;
};

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'web_research',
    risk: 'web_read',
    description: 'Search the public web and read top sources; returns a grounded summary with cited sources. Use only when current or external information is genuinely needed.',
    args: { query: 'a self-contained web search query' },
    validate: (a) => nonEmpty(a.query, 'query', 300),
  },
  {
    name: 'read_core',
    risk: 'core_read',
    description: "Look up the user's saved Core notes about a topic. Use when personal context (their projects, goals, preferences) would improve the result.",
    args: { topic: 'what to look up, a few words' },
    validate: (a) => nonEmpty(a.topic, 'topic', 200),
  },
  {
    name: 'read_attachments',
    risk: 'local_read_scoped',
    description: 'Read the documents the user attached to this conversation. Only those files; nothing else on the device.',
    args: {},
    validate: () => null,
  },
  {
    name: 'create_artifact',
    risk: 'artifact_draft',
    description: 'Produce a NEW structured markdown artifact (brief, plan, checklist, notes, draft) as the task deliverable. Give it a clear title and describe what it must contain. Never recreate an artifact that already exists — use revise_artifact instead.',
    args: {
      title: 'short artifact title',
      outline: 'what the artifact must contain, one line',
    },
    validate: (a) => nonEmpty(a.title, 'title', 120) ?? nonEmpty(a.outline, 'outline', 500),
  },
  {
    name: 'revise_artifact',
    risk: 'artifact_draft',
    description: 'Improve, extend, or change an artifact that already exists in this task, keeping it as one document. Name it by its title and say what to change.',
    args: {
      title: 'title of the existing artifact',
      instruction: 'what to change, add, or improve, one line',
    },
    validate: (a) => nonEmpty(a.title, 'title', 120) ?? nonEmpty(a.instruction, 'instruction', 500),
  },
  {
    name: 'ask_user',
    risk: 'interaction',
    description: 'Ask the user ONE short clarifying question with 2-4 options. Only when a missing detail would materially change the result.',
    args: { question: 'the question', options: 'options separated by |' },
    validate: (a) => {
      const err = nonEmpty(a.question, 'question', 200);
      if (err) return err;
      const opts = (a.options ?? '').split('|').map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 4) return 'need 2-4 options';
      return null;
    },
  },
  {
    // Deliberately payload-free: the kernel composes the final reply from the
    // task record, so a small model can always end a task with 12 tokens of
    // JSON — completion must never depend on perfect long-form formatting.
    name: 'finish',
    risk: 'terminal',
    description: 'End the task once the goal is satisfied by the completed work. Aether then writes the final reply from that work — no answer text is needed here.',
    args: {},
    validate: () => null,
  },
];

export type ToolExecutor = (
  args: Record<string, string>,
  ctx: TaskContext,
  onProgress: (status: string) => void,
) => Promise<ToolResult>;

export class ToolRegistry {
  private specs = new Map<string, ToolSpec>();
  private executors = new Map<string, ToolExecutor>();

  constructor(executors: Record<string, ToolExecutor>) {
    for (const spec of TOOL_SPECS) this.specs.set(spec.name, spec);
    for (const [name, fn] of Object.entries(executors)) {
      if (this.specs.has(name)) this.executors.set(name, fn);
    }
  }

  get(name: string): ToolSpec | undefined {
    return this.specs.get(name);
  }

  list(): ToolSpec[] {
    return [...this.specs.values()];
  }

  /** Validate a proposal against the closed spec set. Error string or null. */
  validate(action: ProposedAction): string | null {
    const spec = this.specs.get(action.tool);
    if (!spec) return `unknown tool "${action.tool}"`;
    // Drop args the spec doesn't declare — a proposal can't smuggle extras.
    for (const k of Object.keys(action.args)) {
      if (!(k in spec.args)) delete action.args[k];
    }
    return spec.validate(action.args);
  }

  async execute(
    action: ProposedAction,
    ctx: TaskContext,
    onProgress: (status: string) => void,
  ): Promise<ToolResult> {
    const fn = this.executors.get(action.tool);
    if (!fn) return { ok: false, summary: 'tool not available', detail: '' };
    try {
      return await fn(action.args, ctx, onProgress);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'tool failed';
      return { ok: false, summary: `failed: ${msg.slice(0, 120)}`, detail: '' };
    }
  }
}
