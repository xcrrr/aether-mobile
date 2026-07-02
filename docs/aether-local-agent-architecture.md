# Aether Local Agent — Architecture

**Date:** 2026-07-02. Read with `aether-actions-v2-completion-architecture.md`
(completion semantics, unchanged) and `aether-local-agent-product-decision.md` (why).

## The shape of the system

```
user message (Task pill on)
        │
        ▼
routeGoal()  ── deterministic code, zero model calls ──────────────┐
   │ 'chat'      → ordinary chat send (recall, streaming, no task UI)
   │ 'refine'    → runRefineTask: ONE revise call on the existing artifact
   │ 'task'      → runAgentTask: the Agent Kernel loop
        │
        ▼
AgentKernel.runTask (V2, unchanged core)
   step prompt (goal + tools + completed-work view + short history)
   → model proposes ONE action → PolicyEngine decides in code
   → execute → scrub + clamp result → repeat until terminal
   → composeFinal: one grounded answer call, deterministic ledger fallback
        │
        ▼
append-only ledger → receipt (pure projection) → persisted task record
```

## The routing layer (`src/agent/router.ts`)

- Pure function `routeGoal(goal, { hasPriorArtifact })` → `'chat' | 'refine' | 'task'`.
- Runs before any model call; a simple request costs the task system nothing.
- Conservative by design: only unambiguous smalltalk / short knowledge questions route
  to chat; currency words (today, latest, news, price, …) force the task path so
  research-worthy questions are never starved; refinement requires a prior artifact
  AND a refinement-prefixed instruction under 220 chars.
- Ambiguity resolves cheaply anyway: the kernel can finish on step one, which is
  effectively a two-call chat answer.

## Task continuity (`TaskContext.priorArtifacts`)

- `useInference.act` finds the last `agentTaskId` in the conversation, loads that
  task's artifacts, and fixes them into the new task's context at start.
- Kernel treatment:
  - `create_artifact` matching a prior title → blocked with guidance; a second
    attempt completes the task (the deliverable exists).
  - `revise_artifact` can target a prior artifact by normalized title (or as the
    sole candidate); the revised copy joins the current task with the SAME id and
    saved state, so persistence and receipts stay truthful.
  - The completed-work view lists prior artifacts as existing deliverables.

## The refine fast path (`src/agent/refine.ts`)

"Make it shorter" is not a planning problem. Outside strict mode it becomes one
`buildRevisePrompt` call on the target artifact: same document id, one ledger step,
a truthful mini-receipt, deterministic final answer. Failure states nothing changed;
cancellation is honored via the same kernel cancel flag. Strict mode routes
refinements through the kernel so approvals still govern writes.

## Research consent (`TaskContext.researchAllowed`)

Consent is enforced in code, not prompts:
- declined disclosure → `researchAllowed: false` → the research budget is zero, so
  `web_research` disappears from the tool list in every step prompt AND any proposal
  naming it is blocked in the kernel with an honest ledger entry.
- The disclosure modal decline path never discards the message: research falls back
  to ordinary chat; a task runs local-only.

## Autonomy

Two behaviors, one visible control:
- **Default** (`balanced`): reads and drafts run without prompts; every artifact is a
  draft until the user taps Keep. Nothing is ever auto-saved.
- **Ask first** (`strict`): every data/write step shows an approval card first;
  declining records `declined` and skips execution.
- `auto` is no longer selectable (persisted value migrates to default; type retained
  so old task records render). `autoSavesArtifacts` is unreachable from the UI.

## Model split

- **E4B**: full budgets (6 steps / 11 model calls / 2 research runs in default mode);
  the target for research + artifact + clarification workflows.
- **E2B**: narrowed budgets (5/9/2), and the same safety floor: malformed output
  degrades to `composeFinal`, truncated finishes are rescued, silence fails honestly.
  The router means E2B never pays task overhead for simple messages.

## UI contract

- Live card: pulse + current milestone + **Stop**; executed milestones in human
  phrasing; approval cards worded as intent; question cards unchanged. Blocked and
  failed internals appear only in the expandable receipt.
- Receipt: status · executed steps · sources; full honest step list, sources, notes
  on expand. No mode label, no branding.
- Entry: the **Task** pill in the composer actions bar; **Ask first** appears beside
  it only while Task is engaged.

## Files

| File | Role |
|---|---|
| `src/agent/router.ts` | deterministic chat/refine/task routing |
| `src/agent/refine.ts` | one-call artifact refinement |
| `src/agent/AgentKernel.ts` | task loop, V2 completion, continuity + consent gates |
| `src/agent/prompts.ts` | compact prompts; completed-work view incl. prior artifacts |
| `src/agent/PolicyEngine.ts` | (mode, risk) → decision matrix; budgets |
| `src/agent/ToolRegistry.ts` | closed 7-tool set |
| `src/agent/tools.ts` | executors wrapping research / Core / attachments |
| `src/agent/runner.ts` | glue: LiteRT llm, persistence, store; `runRefineTask` |
| `src/agent/taskStorage.ts` | task records + kept artifacts (AsyncStorage) |
| `src/state/useAgentStore.ts` | transient run state; persisted mode (v1 migration) |
| `src/components/chat/AgentTaskCard.tsx` | live card + receipt |
| `src/hooks/useInference.ts` | `act()`: routing, continuity, consent, fallbacks |
