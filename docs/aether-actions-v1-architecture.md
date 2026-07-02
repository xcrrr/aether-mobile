# Aether Actions V1 — Architecture

Date: 2026-07-02. Status: implemented, tested (Jest), pending real-device validation.

## What it is

A native, bounded agent kernel that turns Aether's existing capabilities (chat,
Research, Core memory, attached-file reading) into one goal-driven system. The
user gives a goal via the **Act** pill in the chat input; Aether reasons in small
steps, uses tools inside deterministic policy, produces answers and markdown
artifacts, and always ends with an honest receipt.

Defining principle: **the model decides what the next useful step could be; the
model never decides what permissions it has.**

## Why a native kernel (build-vs-reuse decision)

Evaluated: native kernel from scratch; adapting OpenClaw; adapting Hermes Agent;
adapting LangChain/AutoGPT-style frameworks; hybrids.

Rejected all external runtimes:

- **OpenClaw / Hermes**: server-centric gateway daemons, plugin/skill ecosystems,
  shell runtimes, browser automation. None of it runs inside Expo/RN bridgeless +
  LiteRT with no backend. Importing them would mean a Node process Android won't
  host, a plugin supply chain Aether doesn't want, and a filesystem/network model
  that violates the local-first identity.
- **LangChain/AutoGPT-style**: built for frontier models with native function
  calling and 100k+ contexts. Gemma 4 E2B/E4B via LiteRT has neither. The
  framework would be bigger than the app and fight the 4096-token window.
- **Adopted as concepts only**: risk-classed tool registry, mode-gated policy,
  action receipts.

The clincher from the audit: Aether already had a **proven structured-output
primitive** (`__aether_question` JSON with tolerant parsing in
`app/src/llm/messageParse.ts`). The agent loop reuses that exact contract
(`__aether_action`) instead of pretending LiteRT has function calling.

## Loop design: bounded stepwise propose-act

Compared against planner-first (model writes a full plan, kernel executes).
Rejected planner-first: 2B/4B models plan poorly before information arrives, and
a full plan plus tool outputs cannot fit a 4096-token window. The implemented
loop:

```
goal → [ check cancel/budgets
         → build compact step prompt (goal + tool list + step summaries)
         → model proposes ONE flat JSON action
         → tolerant parse (retry once on malformed, then degrade)
         → ToolRegistry validation (closed set, arg schema, extra args stripped)
         → PolicyEngine decision: auto | approval | blocked
         → execute (or pause for approval / user answer)
         → normalize + scrub result → ledger ] → finish | budget | cancel
      → receipt (pure projection of the ledger)
```

Every task is a bounded task machine with: id, explicit status, fixed
`TaskContext` (mode, scope, attachments — set at start, immutable), step budget,
model-call budget, research budget, wall-clock budget, retry limits, loop
detection (repeat-action hash), cancellation checked after every await, and
persisted state at every transition.

## Modules (all under `app/src/agent/`)

| File | Role |
|---|---|
| `types.ts` | Risk taxonomy, task/step/receipt/artifact types |
| `parse.ts` | `__aether_action` tolerant parsing + action hashing |
| `PolicyEngine.ts` | (mode, riskClass) → decision matrix; per-mode/per-model budgets |
| `ToolRegistry.ts` | Closed tool spec set + arg validation; injected executors |
| `prompts.ts` | 4096-token-frugal prompt builders + `scrubUntrusted` trust boundary |
| `AgentKernel.ts` | The task machine + `buildReceipt` (ledger projection) |
| `tools.ts` | Real executors wrapping ResearchEngine, Core recall, attachments |
| `taskStorage.ts` | AsyncStorage persistence, bounded index, interrupted-task marking |
| `runner.ts` | Glue: real LiteRT calls (`extract(preempt)`), persistence, UI store |

App integration:

- `src/state/useAgentStore.ts` — persisted autonomy mode + transient run state
  (progress, pending approval/question resolvers, cancel).
- `src/hooks/useInference.ts` — `act(goal)` entry: appends user turn, runs the
  kernel, lands `finalAnswer` + receipt on the assistant message.
- `src/components/chat/AgentTaskCard.tsx` — live card (progress, approvals,
  question) + receipt card (steps, sources, artifacts with View/Keep).
- `src/components/chat/ChatInput.tsx` — Act pill + Strict/Balanced/Auto chips.
- `src/components/chat/MessageBubble.tsx` — renders live card on the in-flight
  message, receipt card on finished ones.
- `src/state/useChatStore.ts` — `setAssistantAgent`; `stopGeneration` also
  cancels a live agent task.
- `app/_layout.tsx` — marks interrupted tasks at startup.
- `src/types/index.ts` — `Message.agentTaskId` / `Message.agentReceipt`.

## Concurrency and models

All kernel model calls ride the existing serialized `Llama.extract(preempt:true)`
path — an agent step can never overlap a chat reply (the single-native-session
invariant holds). Step proposals run at temperature 0.2 with a 220-token cap;
artifact bodies at 900; degrade answers at 700.

E2B vs E4B: identical policy, narrower budgets on E2B (≤5 steps, ≤2 research,
smaller detail windows into prompts). Both degrade the same way: malformed
output → retry once with a format reminder → direct-answer fallback → honest
failure message. A failed task says so; it never pretends.

## Honesty guarantees

- Receipts are a pure projection of the append-only step ledger (`buildReceipt`),
  so they cannot describe work that didn't happen.
- A failed tool result can never be recorded `executed` (kernel branches on
  `result.ok` only).
- Process death: live tasks are marked `interrupted` on next launch
  (`markInterruptedTasks`), never left claiming to run.
- Cancel: kernel flag + `Llama.stop()` + pending approval/question resolvers
  released; checked after every await.
