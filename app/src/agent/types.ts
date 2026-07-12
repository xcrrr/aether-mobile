export type AgentMode = 'strict' | 'balanced' | 'auto';

/**
 * Risk taxonomy for Aether Actions. A tool declares exactly one class; the
 * PolicyEngine maps (mode, class) to a decision in deterministic code. The
 * model can propose actions but can never change a class, a mode, or a
 * decision — none of these values ever pass through a prompt.
 */
export type RiskClass =
  /** Read the user's Core memory (private, already on-device). */
  | 'core_read'
  /** Read content the user attached to this conversation. Never arbitrary files. */
  | 'local_read_scoped'
  /** Fetch public web content (research pipeline; SSRF-guarded, sanitized). */
  | 'web_read'
  /** Create a markdown artifact as a task draft. Saving is a separate, user-visible act. */
  | 'artifact_draft'
  /** Ask the user one clarifying question (renders as a question card). */
  | 'interaction'
  /** Finish the task with a final answer. */
  | 'terminal';

export type PolicyDecision = 'auto' | 'approval' | 'blocked';

/** What the model proposed for one step, after tolerant parsing. */
export interface ProposedAction {
  tool: string;
  args: Record<string, string>;
}

export type StepStatus =
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'declined'
  | 'skipped';

/** One ledger entry. Receipts are built from these and nothing else. */
export interface AgentStep {
  tool: string;
  /** Short human-readable rendering of the args ("query: gemma 4 benchmarks"). */
  argsSummary: string;
  decision: PolicyDecision;
  status: StepStatus;
  /** Short outcome summary shown in the receipt and fed back to the model. */
  summary: string;
  at: number;
}

export interface AgentSource {
  title: string;
  url: string;
}

/** Coarse artifact kind, shown as a compact label in Library. */
export type ArtifactType = 'document' | 'plan' | 'report' | 'note';

export interface AgentArtifact {
  id: string;
  taskId: string;
  title: string;
  content: string;
  createdAt: number;
  /** True once the user kept it (or Auto mode saved it to the workspace). */
  saved: boolean;
  /** Compact kind label for Library. Absent on legacy records → treated as 'document'. */
  type?: ArtifactType;
  /** Set when kept/renamed in Library. Absent → falls back to createdAt. */
  updatedAt?: number;
  /** Conversation the task ran in, when known — for "From Task" source context. */
  sourceConversationId?: string;
}

export type TaskStatus =
  | 'running'
  | 'awaiting_approval'
  | 'awaiting_user'
  | 'done'
  | 'failed'
  | 'cancelled'
  /** App died or model failed while the task was live; marked on next launch. */
  | 'interrupted';

export interface AgentReceipt {
  goal: string;
  mode: AgentMode;
  status: TaskStatus;
  startedAt: number;
  endedAt: number;
  steps: AgentStep[];
  sources: AgentSource[];
  artifacts: { id: string; title: string; saved: boolean }[];
  /** Honest caveats: what was intentionally not done, remaining uncertainty. */
  notes?: string;
}

export interface AgentTask {
  id: string;
  conversationId: string;
  goal: string;
  mode: AgentMode;
  modelId: string | null;
  status: TaskStatus;
  startedAt: number;
  endedAt: number | null;
  steps: AgentStep[];
  sources: AgentSource[];
  artifacts: AgentArtifact[];
  finalAnswer: string;
}

/** Normalized result every tool returns. Tools never throw across the kernel boundary. */
export interface ToolResult {
  ok: boolean;
  /** One-line outcome for the ledger/receipt ("read 3 sources", "no matching notes"). */
  summary: string;
  /**
   * Untrusted payload for the model's next-step context. Sanitized and clamped
   * by the kernel before it ever reaches a prompt.
   */
  detail: string;
  sources?: AgentSource[];
  artifact?: { title: string; content: string };
}

export interface ToolSpec {
  name: string;
  risk: RiskClass;
  /** One line shown to the model in the tool list. */
  description: string;
  /** Arg names → short description; only these keys are accepted. */
  args: Record<string, string>;
  /** Deterministic validation. Returns an error string or null. */
  validate: (args: Record<string, string>) => string | null;
}

export interface Budgets {
  maxSteps: number;
  maxWebResearch: number;
  maxModelCalls: number;
  wallClockMs: number;
}

/** Everything a task is allowed to touch, fixed at task start. */
export interface TaskContext {
  conversationId: string;
  goal: string;
  mode: AgentMode;
  modelId: string | null;
  /** Extracted text of files the user attached in this conversation. */
  attachments: { name: string; text: string }[];
  /**
   * Artifacts from earlier tasks in this conversation. The kernel treats them
   * as existing deliverables: never recreated, revisable in place.
   */
  priorArtifacts?: AgentArtifact[];
  /**
   * False when the user declined the online Research disclosure for this task:
   * web_research is then hidden from the model and blocked in code. Default true.
   */
  researchAllowed?: boolean;
  /**
   * Compact grounding block built by agent/context.ts: recent conversation turns
   * plus the most recent structured research handoff from this same conversation.
   * Lets a referential goal ("make a document about why he died") resolve who/what
   * it means and see what Research actually found, without pasting the raw
   * transcript. Empty string when there is nothing to ground (e.g. a brand new
   * conversation) — prompt builders skip the block entirely in that case.
   */
  conversationContext?: string;
}
