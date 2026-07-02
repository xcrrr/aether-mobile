# Aether Actions V2 — cofounder note (2026-07-02)

V1 failed on device: it did real work, then couldn't end (finish required the
whole answer inside 220-token JSON), looped, and recreated artifacts. V2 makes
completion kernel-owned.

**What changed (all in `app/src/agent/` + `AgentTaskCard.tsx`):**

- `finish` is now a payload-free signal; the kernel composes the final reply in
  a dedicated grounded call, with a deterministic code-built ledger answer as
  the floor. Terminal is always reachable; terminal is terminal.
- Truncated/malformed finish is rescued (`looksLikeFinish`) — formatting can
  never trap a task.
- Artifact identity is normalized (`normalizeKey`): equivalent title OR outline
  is never created twice; a second duplicate attempt completes the task.
- New `revise_artifact` tool: in-place refinement, same id, same saved state.
- Step prompts carry a structured "Work already completed" view.
- Blocked proposals no longer burn the step budget (maxModelCalls stays the
  hard bound).
- Policy matrix unchanged. Balanced never prompting is by design (drafts need
  an explicit Keep). Strict prompts for every data/artifact action.

**State:** 393/393 tests green, typecheck clean. Device validation NOT done —
script in `docs/aether-actions-v2-device-test.md` (8 tests with pass/fail
criteria). Full design rationale: `docs/aether-actions-v2-completion-architecture.md`.

**If a device test fails:** the receipt/ledger is ground truth; every terminal
path goes through `composeFinal` in `AgentKernel.ts` — start there.
