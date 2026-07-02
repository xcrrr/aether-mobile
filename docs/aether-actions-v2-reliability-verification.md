# Aether Actions V2 — Reliability Verification

**Date:** 2026-07-02
**Result:** 393/393 Jest tests green (32 suites), `tsc --noEmit` strict clean.

Mapping of the V2 reliability requirements to automated tests. All tests live
in `app/src/agent/` unless noted.

| # | Requirement | Test |
|---|---|---|
| 1 | Artifact created → clean completion | `AgentKernel.test.ts` "creates an artifact draft in balanced (not saved), then completes cleanly" |
| 2 | Artifact not recreated on the next loop | "an equivalent artifact (retitled) is never created twice; insisting completes the task" |
| 3 | Malformed/incomplete finish cannot trap the task | "a truncated/malformed finish still ends the task with a composed answer"; `parse.test.ts` looksLikeFinish |
| 4 | Missing final answer degrades to a grounded ledger answer | "compose failure with real work degrades to a deterministic ledger answer" |
| 5 | One and only one terminal state | "a terminal outcome is terminal: no model calls after done" |
| 6 | Final answer grounded, cannot claim unperformed actions | same test asserts no "researched/source" claims without research; `prompts.test.ts` buildFinalAnswerPrompt grounding rules |
| 7 | Strict visibly requires approval | "strict mode never executes a data tool without approval"; "…requires approval for artifact creation and revision" |
| 8 | Decline prevents execution, recorded honestly | "a declined step is recorded declined, never executed, and the task still ends" |
| 9 | Balanced auto-runs only scoped reads | "balanced mode runs reads without any approval prompt" + PolicyEngine matrix tests |
| 10 | Auto saves only inside the workspace | "auto mode marks artifacts saved…"; `runner.ts` persists via `saveArtifact` only |
| 11 | Planner receives structured completed-work info | "the step prompt carries a structured completed-work view after an artifact"; `prompts.test.ts` workLines |
| 12 | Dedup: identical action / same title / equivalent output / retry-after-failure | duplication describe-block (3 tests) |
| 13 | Simple goal doesn't waste tools | "a plain-chat-sized goal can finish on step one (no tool theatre)" |
| 14 | Research goal completes with usable result | "runs research, finishes on a bare signal, and composes the answer" |
| 15 | One clarification → answered → completion | "ask_user pauses, folds the answer into context, then completes" |
| 16 | Malformed output degrades safely (E2B) | "cannot loop forever on malformed output"; E2B budget narrowing in `PolicyEngine.test.ts` |
| 17 | Multi-step completion without protocol leaking into chat | final answers come from composeFinal only; action JSON never in `finalAnswer` (all completion tests) |
| 18 | Cancellation/interruption can't present as completed | cancellation describe-block incl. "cancel during the compose call cannot present the task as completed"; `taskStorage.test.ts` interrupted marking |
| 19 | Receipts distinguish proposed/approved/declined/attempted/completed/failed/saved/drafted | ledger `decision` + `status` fields; receipt mirror tests; artifact `saved` flag |
| 20 | Normal chat unchanged | agent path only runs via the Act pill (`useInference.act`); full suite green including all chat tests |

Also verified (pre-existing, still green): injection resistance (action JSON in
tool output cannot mint actions; Gemma control tokens scrubbed), mode
immutability mid-task, budget enforcement, self-grant blocking.

## Not verifiable in Jest — requires the device pass

- LiteRT/Gemma actually emitting the trivial finish JSON reliably
- approval card visibility/ergonomics on a real screen
- wall-clock behavior with real generation latency
- research pipeline behavior on live network

See `aether-actions-v2-device-test.md`.
