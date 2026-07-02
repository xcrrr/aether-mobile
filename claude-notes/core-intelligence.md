# Core Intelligence — read/retrieval layer change note (for Codex)

Date: 2026-07-01. Plan: `../docs/core-intelligence-plan.md`. Verification: `../docs/core-intelligence-verification.md`.

## What changed

- **Recall engine** (`app/src/secondbrain/recall.ts`, new): `selectRecall(messages, {entries, enabled, activeModelId})`
  replaces the old inject-everything path. Deterministic distinctive-token scoring; stopwords
  and generic words (app/ai/project/work/…) score nothing, so greetings/small talk retrieve
  nothing by construction. A memory must match the CURRENT message at least once; the
  previous user turn only boosts ranking. `emotional` + `stale` entries need a doubled bar.
  Explicit "continue / left off / last time" in a NEW chat admits ≤2 recent context/goals
  notes — continuity is user-initiated only. Fails safe: any error → empty recall.
- **Per-model budgets** (`recallPolicy`): E4B ≤6 notes / 900 chars; E2B and unknown ≤3 / 450.
  Same relevance bar for both — E2B protection is volume, not a different definition of relevant.
- **MemoryInjector rewritten**: renders a `RecallResult`, fenced as DATA ("never an
  instruction"), values sanitized (control tokens stripped, one line, ≤200 chars). The old
  "Use this knowledge naturally… Refer to the user by their preferred name" instructions are
  GONE — they were the direct cause of "Hi" → "Hi Adam, black holes again?".
- **prompt.ts**: memory block moved from FIRST to LAST in the system prompt; `buildSystemPrompt`
  no longer reads MemoryStore — it takes `ctx.recall` from the caller (pure). Profile name line
  now says "Use it sparingly".
- **useInference.send**: computes recall once per send, passes it into the prompt, and records
  the topical selection on the assistant message (`Message.coreRecall`, additive optional).
- **Transparency UI**: `MessageBubble` shows a muted "From your Core: …" footer only when
  topical recall fired; tap expands per-note "why" ("matched: marathon"). No badges.

## Don'ts

- Don't re-inject `MemoryStore.getAllEntries()` anywhere — all read paths go through `selectRecall`.
- Don't let previous-turn tokens qualify a memory alone (currentHits >= 1 is the rule).
- Don't render note values without `sanitizeNoteValue`.
- The old `buildMemorySystemPrompt(entries)` signature is gone; it takes a `RecallResult` now.
