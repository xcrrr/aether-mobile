# Second Brain Phase 1 — architecture change note (for Codex)

Date: 2026-07-01. Full plan: `../docs/second-brain-phase-1-plan.md`. Verification: `../docs/second-brain-phase-1-verification.md`.

## What changed

- **Grounding gate** (`app/src/secondbrain/grounding.ts`, new): every extracted fact must carry a `quote` that mechanically matches the USER's messages (normalized substring or ≥0.8 token containment). No grounded quote → no write. This closes the assistant-hallucination path.
- **Schema v2 (additive)**: `MemoryEntry` gains optional `evidence`, `reason`, `history[]`. No storage-key or field changes — existing user data rehydrates untouched.
- **Conflict handling**: changed value → old value pushed to `history` (cap 5), confidence taken from the new observation, `timesReinforced` reset. Same value → reinforce, confidence = max (the old `+0.05` inflation is gone).
- **Model policies** (`extractionPolicy` in MemoryExtractor): E4B gate 0.7 / ≤5 facts / ≤3 links; E2B and unknown 0.8 / 3 / 2.
- **Graph links are real only**: `toGraphData` now emits only `explicit` (model-extracted) and `discussed_together` (single star per source conversation). All keyword/category/bridge link fabrication is deleted. Stats are honest now.
- **Stale rule**: was dead (confidence<0.4 could never occur); now = single unconfirmed observation unseen for 90 days.
- **UI**: `MemoryListPanel` is now actually mounted (list icon on the graph screen — it was dead code). Detail sheet shows "Why this was saved" (verbatim quote + reason), "Previously" (history), and has Edit/Delete. The fake "Explore connections" button is gone.

## Don'ts

- Don't re-add derived graph links "for density" — density must come from real data.
- Don't bypass `groundingScore` when adding new write paths to `MemoryStore`.
- `assets/graph/*` scene untouched — force constants may want one tuning pass on device with sparser links.
