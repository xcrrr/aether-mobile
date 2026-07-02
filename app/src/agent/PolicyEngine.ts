import { AgentMode, Budgets, PolicyDecision, RiskClass } from './types';

/**
 * The deterministic authority over what an agent task may do. The model
 * proposes; this module decides. Nothing here reads model output, tool output,
 * or prompt text — decisions are a pure function of (mode, risk class), and
 * budgets are a pure function of (mode, model). There is deliberately no way
 * to widen a decision at runtime.
 */

const MATRIX: Record<AgentMode, Record<RiskClass, PolicyDecision>> = {
  strict: {
    core_read: 'approval',
    local_read_scoped: 'approval',
    web_read: 'approval',
    artifact_draft: 'approval',
    interaction: 'auto', // asking the user IS the approval surface
    terminal: 'auto',
  },
  balanced: {
    core_read: 'auto',
    local_read_scoped: 'auto',
    web_read: 'auto',
    artifact_draft: 'auto', // draft only; keeping it is an explicit user tap
    interaction: 'auto',
    terminal: 'auto',
  },
  auto: {
    core_read: 'auto',
    local_read_scoped: 'auto',
    web_read: 'auto',
    artifact_draft: 'auto',
    interaction: 'auto',
    terminal: 'auto',
  },
};

export function decide(mode: AgentMode, risk: RiskClass): PolicyDecision {
  return MATRIX[mode]?.[risk] ?? 'blocked';
}

/** Whether an artifact draft is persisted to the workspace without a user tap. */
export function autoSavesArtifacts(mode: AgentMode): boolean {
  return mode === 'auto';
}

const BASE_BUDGETS: Record<AgentMode, Budgets> = {
  strict: { maxSteps: 5, maxWebResearch: 2, maxModelCalls: 9, wallClockMs: 6 * 60_000 },
  balanced: { maxSteps: 6, maxWebResearch: 2, maxModelCalls: 11, wallClockMs: 6 * 60_000 },
  auto: { maxSteps: 8, maxWebResearch: 3, maxModelCalls: 14, wallClockMs: 8 * 60_000 },
};

/** E2B gets narrower budgets: fewer decisions for the smaller model to get wrong. */
export function budgetsFor(mode: AgentMode, modelId: string | null): Budgets {
  const base = BASE_BUDGETS[mode];
  if (modelId === 'gemma4-e2b') {
    return {
      ...base,
      maxSteps: Math.min(base.maxSteps, 5),
      maxWebResearch: Math.min(base.maxWebResearch, 2),
      maxModelCalls: Math.min(base.maxModelCalls, 9),
    };
  }
  return base;
}

export const MAX_RETRIES_PER_TOOL = 1;
/** Consecutive malformed model outputs tolerated before degrading to a direct answer. */
export const MAX_MALFORMED = 2;
