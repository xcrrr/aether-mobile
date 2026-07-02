# Aether Actions V1 — Permission Modes

**Superseded (2026-07-02):** the UI now exposes one default plus an "Ask first" toggle (strict); Auto is no longer selectable. See `aether-local-agent-product-decision.md`. The matrix below still describes the underlying PolicyEngine.

Modes are real policy, enforced in `app/src/agent/PolicyEngine.ts`, selected via
chips under the Act pill, persisted in `useAgentStore` (`@aether/agent-mode`),
and **fixed into the task context at start** — nothing mid-task can change them.

## Decision matrix

| Risk class | Strict | Balanced (default) | Auto |
|---|---|---|---|
| `core_read` | approval | auto | auto |
| `local_read_scoped` | approval | auto | auto |
| `web_read` | approval | auto | auto |
| `artifact_draft` | approval | auto (draft) | auto (saved) |
| `interaction` (ask_user) | auto | auto | auto |
| `terminal` (finish) | auto | auto | auto |
| anything else | blocked | blocked | blocked |

`interaction` and `terminal` are auto everywhere because they are themselves
user-facing: a question card and the final answer.

## Artifact write semantics

- Strict/Balanced: `create_artifact` produces a **draft** shown on the task
  card. It becomes persistent only when the user taps **Keep**. No approval-free
  write ever leaves the task.
- Auto: drafts are additionally saved into the local artifacts workspace
  (`@aether/agent-artifacts`) automatically — this is the one capability Auto
  adds, and it is on-device, bounded (50 entries), and visible in the receipt
  ("saved to workspace").

## Budgets (per task)

| | Strict | Balanced | Auto |
|---|---|---|---|
| Max steps | 5 | 6 | 8 |
| Max web research | 2 | 2 | 3 |
| Max model calls | 9 | 11 | 14 |
| Wall clock | 6 min | 6 min | 8 min |

E2B override (any mode): steps ≤5, research ≤2, model calls ≤9. Retries per
identical action: 1. Consecutive malformed model outputs: 2, then degrade to a
direct answer.

## What no mode can do

Grant permissions, expand scope mid-task, read files outside user attachments,
touch accounts/messages/contacts/photos, write outside the app's own storage,
send anything other than research GET queries, run after cancel, or keep running
after the app dies (interrupted marking at next launch).

## Approval + receipt surfaces

- Approval card: names the tool, shows the exact args summary, explains the risk
  in one plain sentence (e.g. "Sends this search to the web"). Allow / Skip.
  Skip records a `declined` step; the task continues without it.
- Receipt (every task): status, executed-step count, sources, mode; expandable
  step ledger with real outcomes; artifacts with View/Keep; honest notes
  (stopped, interrupted, failed steps).
