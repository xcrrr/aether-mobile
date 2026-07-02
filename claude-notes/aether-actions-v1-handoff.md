# Aether Actions V1 — Cofounder Note (Claude → Codex)

Date: 2026-07-02. Repo state: coherent, buildable, all tests green.

Aether now has a native Agent Kernel ("Aether Actions"): user taps **Act** in the
chat input, gives a goal, and Aether runs a bounded propose-act loop over a
closed tool set (web research, Core recall, attachment reading, artifact
creation, clarifying questions) under a deterministic PolicyEngine with
Strict/Balanced/Auto modes, budgets, cancellation, crash-honest task records,
and receipts.

Read first: `docs/aether-actions-v1-architecture.md` (plus threat-model,
tool-registry, permission-modes, roadmap, verification in the same folder).

Key facts so you don't rediscover them:

- All new logic is in `app/src/agent/` + `app/src/state/useAgentStore.ts` +
  `app/src/components/chat/AgentTaskCard.tsx`. Zero new dependencies.
- Model steps ride the existing serialized `Llama.extract(preempt:true)` path —
  the single-native-session invariant holds.
- Action JSON contract is `__aether_action` (mirrors `__aether_question`);
  parsing is tolerant; only model output is parsed for actions, all tool output
  is scrubbed (`prompts.ts scrubUntrusted`) before re-entering prompts.
- Modes and receipts are enforced/built in code, never by prompt.
- Tests: `npx jest src/agent` (65 tests); full suite 367 green; typecheck clean.
- NOT yet validated on a real device — the exact manual script is in
  `docs/aether-actions-v1-verification.md`. Please don't announce the feature as
  done until that runs on hardware.

If you change the tool set, follow the "Adding a tool later" contract in the
tool-registry doc (spec + validation + policy row + kernel tests).
