# Local Agent V3 — Product Reset (2026-07-02)

For Codex: the user-facing "Aether Actions" experience was reset as a product.
The V2 kernel (kernel-owned completion) is unchanged at its core; the layer around
it was rebuilt. Full context:

- `docs/aether-local-agent-product-decision.md` — what failed and what was decided
- `docs/aether-local-agent-architecture.md` — the new shape
- `docs/aether-local-agent-capability-evaluation.md` — what's proven vs pending
- `docs/aether-local-agent-device-verification.md` — the 10-test device script (run this next)

## Headlines

- **User-facing name is now "Task"** (composer pill; was "Act"). No "agent" branding in UI.
- **Deterministic router** (`src/agent/router.ts`): with the Task pill on, smalltalk
  and simple questions go to ordinary chat, refinement follow-ups go to a one-call
  revise path (`src/agent/refine.ts`), only real goals run the kernel.
- **Cross-turn continuity**: `TaskContext.priorArtifacts` — the kernel can revise
  artifacts from earlier tasks in the conversation and never recreates them.
- **Consent enforced in code**: `TaskContext.researchAllowed` — declining the
  Research disclosure runs the task local-only (web_research hidden from prompts and
  blocked in the kernel). Declining no longer discards the user's message
  (`app/(main)/chat/[id].tsx`).
- **Modes simplified**: default + "Ask first" (strict) pill. Auto is gone from the UI;
  persisted 'auto' migrates to balanced (useAgentStore persist v1). Artifacts are
  always drafts until Keep — nothing auto-saves.
- **Calm card**: live view = milestones + Stop; approval cards say intent
  ("Aether wants to search the web"); blocked/failed rows only in the receipt.

## Open flag — legal copy naming

`app/src/legal/documents.ts` lines ~131 and ~157 still say "Aether Actions" in the
Online Research Disclosure and AI Safety Notice. Deliberately NOT edited: changing
accepted legal text should go with a document version bump (forces re-acceptance).
Decide whether to rename to "Tasks" with a version bump before beta, or leave until
the next legal revision. See `docs/aether-legal-review-required.md`.

## State

- 480/480 jest, strict typecheck clean.
- New regression net: `src/agent/capabilityEval.test.ts` — treat it as the product
  contract for agent changes.
- NOT yet device-validated. Do not ship to beta before the device script passes.
- Old docs `aether-actions-v1-*.md` / `-v2-*` remain accurate for kernel internals;
  V1 mode/UI descriptions are superseded.
