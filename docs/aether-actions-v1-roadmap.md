# Aether Actions — Roadmap

## V1 (this pass) — shipped in code, needs device validation

Goal → steps → tools (research, Core, attachments, artifacts, clarifying
questions) → answer + receipt. Strict/Balanced/Auto enforced by the
PolicyEngine. Foreground-only, cancellable, crash-honest.

## V1.1 — polish and proof (next)

- Real-device validation pass on E2B and E4B (see verification doc), including
  adversarial pages/documents against the live model.
- Tune step-prompt wording against real Gemma behavior (action-JSON hit rate,
  premature `finish`, research query quality). The prompt contract is isolated
  in `prompts.ts` for exactly this.
- Artifacts browser: a small screen listing kept artifacts (storage +
  Keep flow already exist).
- Receipt niceties: durations per step, tap source → open in browser sheet.
- Design pass on AgentTaskCard against the ModelLoadingOverlay bar.

## V2 — scoped workspace

- SAF tree-URI folder grants: user picks a folder once, agent reads within it
  (`local_read_scoped` extension with a persisted, revocable scope UI).
- Local export (`external_write` class, final-approval-required): save artifact
  as a file / share sheet.
- Multi-artifact tasks and artifact revision ("improve this draft").
- Task history screen fed by the existing bounded task index.

## V3 — carefully, if evidence supports

- Reminder/notification proposals (proposal-only; user confirms into OS).
- Follow-up task suggestions after a receipt.
- Queued tasks that resume on next app open (WorkManager only if it can be
  honest; never a daemon, never "24/7 agent" claims).
- Patch/diff proposal generation over a granted code folder (E4B only, artifact
  output — never applies changes itself).

## Explicit non-goals (standing)

External comms (email/messages/publishing), purchases, account access, plugin
or skill marketplaces, shell execution, browser automation on authenticated
sessions, background daemons, cloud execution of any kind.
