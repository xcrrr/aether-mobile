# Aether Local Agent — Product Decision

**Date:** 2026-07-02
**Supersedes:** the broad "Aether Actions repair" framing. Builds on V2 kernel-owned
completion (`aether-actions-v2-completion-architecture.md`), which stays authoritative
for completion semantics.

## The decision: C + D — keep the kernel core, rebuild the product layer

Options considered:

- **A. Preserve + focused corrections** — insufficient. The V2 kernel is sound, but the
  product failures live *around* it: routing, continuity, modes, naming, disclosure UX.
- **B. Substantial architecture rebuild** — unjustified. Real-device V1 failures were
  completion-architecture bugs, already fixed in V2 with a design that matches the
  device constraints (4096-token window, one serialized LiteRT session, 220-token step
  proposals). Rebuilding the loop again, without device access in this environment,
  would trade a tested core for an untested one.
- **C. Make the strong workflows excellent, gate nothing new** — chosen for the core.
- **D. Feature-flag unfinished paths** — chosen narrowly: the Auto autonomy mode is
  removed from the UI (retained in types for old records) because it was an invisible
  scope expansion with no legibility.

## What the audit actually found (verified in code)

1. **No routing.** With the Act pill on, *every* message entered the kernel loop —
   "hi" cost ≥2 model calls and produced task UI. Ordinary chat was strictly better
   for anything simple. (`useInference.act` → `runAgentTask` unconditionally.)
2. **No cross-turn continuity.** Each act() was a fresh task; prior artifacts were
   invisible. "Make it shorter" re-planned from zero and re-created the deliverable.
3. **Disclosure over-gating + message loss.** The online-Research disclosure gated
   every task, including fully local ones — and *declining silently discarded the
   user's message* (input was already cleared). (`chat/[id].tsx` decline handler.)
4. **Mode noise.** A three-way Strict/Balanced/Auto chip row with jargon descriptions
   appeared in the composer. Balanced never prompts (by design), so the distinction
   read as decoration; Auto silently auto-saved artifacts — scope expansion the user
   never saw happen.
5. **Agent theater in the card.** "Actions · Balanced" branding, raw ledger rows for
   blocked/failed steps live, technical summaries. No Stop affordance on the card.
6. **Naming.** "Act"/"Actions" describes machinery, not outcomes.

## What was built

| Failure | Fix |
|---|---|
| Everything enters the loop | Deterministic `router.ts`: chat / refine / task, decided in code before any model call. Conservative: only unambiguous smalltalk/simple questions leave the task default; currency-sensitive questions never route to plain chat. |
| No continuity | `TaskContext.priorArtifacts`: earlier artifacts in the conversation are existing deliverables — dedup blocks recreation, `revise_artifact` targets them in place (same id, same saved state), prompts state they exist. |
| Refinement = full re-plan | Refine fast path (`refine.ts`): one revise model call on the existing document. Strict mode still routes refinements through the kernel so the approval matrix governs every write. |
| Disclosure swallows messages | Decline now falls back honestly: research → ordinary local chat; task → runs with `researchAllowed: false`, enforced in code (web_research hidden from prompts AND blocked in the kernel). |
| Three modes | One default (Aether handles steps; artifacts stay drafts until Keep) plus a single **Ask first** pill (strict). Auto removed from UI; persisted `auto` migrates to the default. Nothing auto-saves anymore. |
| Agent theater | Live card is milestone-led: current status + Stop, executed milestones in human phrasing, approvals worded as intent ("Aether wants to search the web"). Blocked/failed internals live only in the receipt. Receipt drops the mode label. |
| Naming | User-facing name is **Task** ("Give Aether a task..."). The word "agent" stays internal. |

## What was deliberately kept

- V2 kernel-owned completion: payload-free `finish`, one `composeFinal` terminal
  routine, deterministic ledger fallback, `looksLikeFinish` rescue, duplicate-attempt
  completion. **Do not reintroduce a finish action that carries the answer.**
- PolicyEngine matrix, closed ToolRegistry, append-only ledger, receipts as pure
  ledger projections, scrub-everything trust boundary, E2B narrowed budgets,
  crash honesty (`markInterruptedTasks`).
- The existing Research disclosure/legal infrastructure — consent is still the gate;
  what changed is that declining is now honored with useful degraded behavior instead
  of silence.

## Why not more

- No new tools, no new model, no workflow-template engine: the seven-tool surface
  already covers the supported workflows; templates would add prompt ceremony a 4B
  model must parse without demonstrated outcome gains. Revisit after device data.
- Renaming beyond the pill (e.g. a dedicated task surface) rejected: the product
  direction is chat-native and quiet.

## Beta verdict

Worthy of closed-beta visibility **conditional on the device verification script
passing** (`aether-local-agent-device-verification.md`). Everything provable without
a device is proven (480 tests, strict typecheck); prompt quality against live Gemma
output remains the open risk.
