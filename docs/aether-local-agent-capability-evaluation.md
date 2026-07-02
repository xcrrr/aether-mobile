# Aether Local Agent — Capability Evaluation

**Date:** 2026-07-02
**Harness:** `app/src/agent/capabilityEval.test.ts` (deterministic, scripted model
personas against the real kernel/registry/router) plus the existing agent suites.
Full run: **480/480 tests green, strict typecheck clean** (jest, 38 suites).

## What the harness proves (proven by code/tests)

| # | Product requirement | Status |
|---|---|---|
| 1 | Simple request stays ordinary chat, zero task machinery | ✅ router tests + eval 1 |
| 2 | Current-info request researches only when justified AND permitted | ✅ eval 2 (consent gate: tool hidden from prompts, blocked in code, honest ledger entry) |
| 3 | Research + artifact → one deliverable, real final answer, clean end | ✅ eval 3 |
| 4 | Rephrased duplicate → refinement/completion, never a second artifact (within a task AND across turns) | ✅ eval 4 |
| 5 | Refinement operates on the existing result, same document id, saved state preserved | ✅ eval 5 |
| 6 | One clarification asked, answered, remembered, completed | ✅ eval 6 |
| 7 | Sloppy model (malformed JSON, truncation, silence) cannot loop or leak protocol; silence fails honestly | ✅ eval 7 |
| 8 | Ask first (strict) visibly gates steps; decline records `declined`, executes nothing, never fakes completion | ✅ eval 8 |
| 9 | Stop → honest cancelled state, no post-cancel answer | ✅ eval 9 + kernel tests |
| 10 | Final answers never claim work outside the ledger (deterministic fallback reads only the ledger) | ✅ eval 10 |
| 11 | Higher autonomy can never expand scope | ✅ PolicyEngine tests; Auto removed from UI; nothing auto-saves |
| 12 | Declining the disclosure never swallows the message | ✅ by code path (chat screen decline → local chat / local-only task) — UI-level, verify on device |
| 13 | Crash honesty: interrupted tasks never claim completion | ✅ taskStorage tests |

## What is inferred (reasonable, not proven here)

- The router's heuristics match real user phrasing distribution. The rules are
  conservative (default = task), so the failure mode is paying task overhead on a
  chat-ish message — degraded, not broken.
- One revise call produces good refinements on live Gemma output (the prompt is the
  same `buildRevisePrompt` the kernel uses).

## What still requires device validation (cannot be proven in this environment)

- Live Gemma E2B/E4B compliance with the one-action JSON contract at real
  temperatures and context pressure.
- Artifact quality at 900 max tokens; final-answer quality at 700.
- Latency/wall-clock feel of a 3–5 step task on-device.
- Visual quality of the new live card / receipt in both themes.

Run `aether-local-agent-device-verification.md` (15–20 min) before exposing the
feature in a closed beta.

## Regression net

Any future agent change must keep these suites green:
`router.test.ts`, `capabilityEval.test.ts`, `AgentKernel.test.ts`, `prompts.test.ts`,
`parse.test.ts`, `ToolRegistry.test.ts`, `PolicyEngine.test.ts`, `taskStorage.test.ts`.
The eval file is the product contract — extend it when a workflow is added or a
device failure is reproduced.
