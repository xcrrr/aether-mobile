# Aether Actions V2 — Completion Architecture

**Date:** 2026-07-02
**Status:** Implemented; device validation pending (see `aether-actions-v2-device-test.md`)

## Why V2 exists

Real APK testing showed V1 doing useful work and then failing to end: looping,
recreating artifacts it had already created, and never delivering a normal
final answer. These were architecture bugs, not model-quality problems.

### Root causes found in V1

1. **`finish` was physically impossible for real answers.** The V1 `finish`
   tool required the complete markdown answer inside a JSON string arg — but
   step proposals ran with `maxTokens: 220`. Any substantial answer truncated
   mid-JSON, the parse failed, the step counted as "malformed", and the loop
   continued. This was the product-blocking defect.
2. **Malformed finishes didn't complete from done work.** Degradation needed
   3 *consecutive* malformed outputs; any valid (often duplicate) proposal in
   between reset the streak. The agent ground on until a budget died.
3. **Artifact dedup was exact-args-only.** `"Study Plan"` vs `"study plan!"`
   were different keys → a whole second artifact got generated. Since finish
   couldn't succeed, recreating the artifact was the model's likeliest next move.
4. **The planner context was a flat step log.** Artifact existence lived in a
   240-char summary string. Nothing told the model "the deliverable exists —
   finish now."
5. **Approvals "not appearing" was a legibility problem, not a rendering bug.**
   The default mode is Balanced, where every V1 tool is `auto` — the policy
   matrix literally never asks.
6. **Blocked/repeat proposals consumed the step budget**, so noise accelerated
   degradation and polluted the ledger the model read next turn.

## The V2 design: kernel-owned completion

The model proposes work. The kernel owns task state, completion semantics,
artifact identity, policy, and truthful finalization.

### 1. `finish` is a payload-free signal

```json
{"__aether_action": true, "tool": "finish", "args": {}}
```

Twelve tokens. `validate()` always passes. A small model can always end a task.

### 2. One terminal routine: `composeFinal`

Every terminal path converges on the same routine in `AgentKernel.ts`:

- explicit `finish` action
- a malformed reply that *names* finish (`looksLikeFinish` regex rescue —
  a truncated V1-style finish payload still ends the task)
- step / model-call / wall-clock budget exhaustion (with an honest caveat
  passed into the prompt)
- repeated malformed output
- a second attempt to create an already-existing artifact (the model clearly
  believes the deliverable is done — so the kernel completes)

`composeFinal` makes ONE dedicated model call with `buildFinalAnswerPrompt`
(goal + structured completed-work view + gathered data window + optional
caveat, `maxTokens: 700`). Grounding rules are in the prompt: never mention
sources/files/actions not listed; summarize artifacts instead of repeating them.

### 3. Deterministic fallback — completion can never fail after real work

If the compose call returns nothing and the ledger shows meaningful work, the
kernel builds the reply **in code** from the ledger alone: artifacts created
(draft vs saved), research done (real source count), Core/attachment reads.
It cannot overclaim because it only reads the ledger. `status: failed` is now
reserved for the case of *zero work and zero answer*.

### 4. A terminal outcome is terminal

`composeFinal` returns the task; the loop is exited by `return`. There is no
code path that iterates after done/failed/cancelled. Cancellation is checked
before and after every model call, including inside `composeFinal` (a reply
generated after cancel is discarded).

### 5. Deterministic artifact identity

`normalizeKey` (lowercase, strip non-alphanumerics) is applied to titles and
outlines. An equivalent proposal (matching normalized title, or matching
normalized outline under a new title) is never created twice:

- first duplicate attempt → blocked with guidance ("already exists — use
  revise_artifact or finish")
- second duplicate attempt → the kernel finalizes the task

Failed generations (empty model output) may retry the same args once — that's
a retry, not a duplicate.

### 6. `revise_artifact` is first-class

Refinement no longer requires recreation. `revise_artifact(title, instruction)`
finds the artifact by normalized title (or the sole artifact), regenerates the
content grounded in the current content + instruction + recent data, and
replaces it **in place** — same id, same saved state, one document.

### 7. Structured completed-work view

Every step prompt now carries a `Work already completed:` section derived only
from the ledger and artifact state: artifacts (with draft/saved and an explicit
do-not-recreate instruction), research queries + source count, Core/attachment
reads, and user answers. The same view grounds the final-answer prompt.

### 8. Blocked proposals don't burn the work budget

`maxSteps` now counts productive steps (executed/failed/declined) only.
`maxModelCalls` remains the hard bound on total iterations, so the loop is
still strictly bounded.

## What was deliberately kept from V1

- model proposes, code enforces (PolicyEngine matrix unchanged)
- closed ToolRegistry; unknown tools blocked by construction
- append-only ledger; receipts as pure ledger projections
- scrub-everything trust boundary (`scrubUntrusted` on all non-code text)
- one serialized LiteRT session; E2B narrowed budgets
- crash honesty (`markInterruptedTasks`)

## Policy modes in real code (unchanged matrix, now legible)

| Risk class | Strict | Balanced | Auto |
|---|---|---|---|
| core_read / local_read_scoped / web_read | approval | auto | auto |
| artifact_draft (create + revise) | approval | auto (draft only) | auto (saved to workspace) |
| interaction / terminal | auto | auto | auto |

Balanced never prompting is **by design** (reads are safe+scoped; artifacts
stay drafts until the user taps Keep). Strict visibly prompts for every data
action and artifact write; declining records `declined` and skips execution.

## Files changed

- `app/src/agent/AgentKernel.ts` — completion rewrite (composeFinal,
  deterministicAnswer, dup prevention, revise, productive-step budgets)
- `app/src/agent/parse.ts` — `looksLikeFinish`, `normalizeKey`
- `app/src/agent/prompts.ts` — `workLines`, `buildFinalAnswerPrompt`,
  `buildRevisePrompt`, step-prompt completed-work section
- `app/src/agent/ToolRegistry.ts` — payload-free `finish`, `revise_artifact`
- `app/src/components/chat/AgentTaskCard.tsx` — revise label/icon
- tests: `AgentKernel.test.ts` (rewritten), `prompts.test.ts` (rewritten),
  `parse.test.ts`, `ToolRegistry.test.ts` (extended)

Unchanged: `PolicyEngine.ts`, `tools.ts`, `taskStorage.ts`, `runner.ts`,
`useAgentStore.ts`, chat wiring. Old persisted task records remain readable
(types unchanged).
