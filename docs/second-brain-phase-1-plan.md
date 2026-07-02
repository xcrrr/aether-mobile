# Second Brain — Phase 1 Plan

Date: 2026-07-01. Owner: Claude. Scope: `app/src/secondbrain/*`, `app/src/components/secondbrain/*`, `app/src/components/settings/SecondBrainScreen.tsx`.

## 1. What is weak or unsafe today

**Extraction (MemoryExtractor.ts)**

- **Open hallucination path.** The extraction transcript includes assistant messages, and no check verifies a saved fact against anything the user actually said. A fact invented by the assistant (or by the extraction model itself) saves exactly like a real one.
- **Confidence is self-reported.** The only quality gate is the model's own `confidence` number. Gemma E2B emits 0.9 for nearly everything, so the 0.7 gate filters almost nothing.
- **No evidence, no reason.** An entry stores only `sourceConversationId`. "Why was this saved?" is unanswerable, which is why the feature feels untrustworthy.
- **Updates silently erase history.** A changed value overwrites the old one with no record, and inherits inflated confidence via `max(prev, new) + 0.05` — confidence only ever rises, even for a fact that just changed.
- **No model differentiation.** E2B and E4B run the same prompt, gates, and caps. The weaker model writes with the same authority as the stronger one.
- **Dead staleness logic.** `markStale` requires confidence < 0.4, but nothing below 0.7 is ever saved. The stale path can never trigger on extracted facts.

**Graph (graphData.ts)**

- **Most links are fabricated.** `toGraphData` invents links from: category hub chains (`same_context`, `nearby_context`, `secondary_context_hub` with `i % 4` arithmetic), shared ≥5-char keyword chains (`mentions_x`, `keyword_cluster_x`), and conversation "bridges" (`i % 3`). These exist to make the graph look dense — the exact "fake links" failure mode. The "N relationships" stat and per-node "connected" counts are therefore fiction.
- The explicit model-extracted links and the "saved from the same conversation" grouping are the only defensible relationship signals present.

**UI**

- **`MemoryListPanel` is dead code.** It is imported nowhere. The live screen has no way to list, edit, delete, or manually add memories, no enable/disable toggle, and no "clear all". Inspectability/edit/delete — core trust requirements — are unreachable.
- The detail sheet's primary button, "Explore connections", just closes the sheet (a fake action). No delete, no edit, no evidence shown.

**What already works and should remain**

- `ExtractionQueue` (idle-drain, never blocks chat streaming, retries on failure) is sound.
- `extract()` in LiteRtService (single-session serialization, `preempt`, silent-yield-when-busy) is sound.
- Trivial-chat gating (`GREETING_ONLY` + `MIN_SUBSTANCE_CHARS`) is sound.
- Store-level dedupe (`dedupeEntries`, same-category same-normalized-value fold on rehydrate and upsert) is sound.
- The Three.js scene: restrained colors, compact-volume forces, label collision, pause-on-blur, reduced-motion support. Structure and interaction (rotate/zoom/tap/search/focus) already meet the direction; it mostly needs honest data, not a rewrite.

## 2. Architecture

### Schema v2 (additive, migration-safe)

`MemoryEntry` gains optional fields — no field removed, no key renamed, no storage-key change:

- `evidence?: string` — verbatim user quote that supports the fact.
- `reason?: string` — one human-readable sentence for why this was saved.
- `history?: { value: string; replacedAt: number }[]` — prior values, newest first, capped at 5.

Migration: `onRehydrateStorage` already backfills legacy payloads; it will leave the new fields absent for legacy entries (UI treats absence as "saved before evidence tracking"). No data is dropped or rewritten. `dedupeEntries` merges histories.

### Extraction v2 — grounding is the gate

1. **Prompt**: each fact must include a `"quote"` field — the user's exact words supporting it. Links constrained to a short relation vocabulary. Known facts still injected to prevent re-emission.
2. **Grounding check (mechanical, not trust-based)**: the quote is normalized (case/whitespace/punctuation) and must appear in the *user* messages of the transcript — substring match, or ≥0.8 token containment for minor paraphrase. A fact whose quote fails grounding is dropped. This structurally blocks assistant hallucinations and extractor inventions: text that only the assistant produced can never ground a fact.
3. **Confidence**: effective confidence = min(model confidence, grounding score). Gate at the model-specific threshold.
4. **Model compatibility**: read `useModelStore.activeModelId`. E4B: gate 0.7, ≤5 facts, ≤3 links per run. E2B: gate 0.8, ≤3 facts, ≤2 links per run. Both share the same grounding mechanism, so final storage quality is equivalent — the weaker model just saves less per pass. Malformed JSON, unknown categories, failed grounding, empty output → zero writes (already partially true; now total).
5. **Conflict/update handling**: key match with a *changed* normalized value → previous value pushed to `history`, confidence set from the new observation (no inflation), `timesReinforced` reset to 0 for the new value. Same value → reinforce (`timesReinforced++`, `lastSeenAt`, confidence = max, no +0.05 creep).

### Graph v2 — only real links

`toGraphData` keeps exactly two link types:

- `explicit` — model-extracted, validated relations (with the extraction evidence).
- `discussed_together` — a single star from the most central memory of each conversation to its siblings ("saved from the same conversation" is real and explainable).

All keyword chains, category hub chains, and bridge arithmetic are deleted. Node `connectionCount` and the "N relationships" stat become honest. Spatial cohesion (one organic volume, category neighborhoods) stays the job of the scene's anchor/gravity/compact-shape forces — layout communicates grouping without fake edges. Scene file untouched except force constants if sparser links visibly scatter the volume.

### UI v2 — trust surfaces

- **Detail sheet**: show "Saved because you said: '<evidence>'" + reason + source + date; add Edit and Delete actions; remove the fake "Explore connections" button. Show previous values when history exists.
- **Mount `MemoryListPanel`** from the graph screen (list icon in the top bar) so list/search/filter/add/delete/clear-all/enable-toggle are reachable. Add the shared edit modal the panel already expects.

## 3. Test strategy

Jest, mocked engine (existing pattern). New/updated tests verify:

- trivial chat → no inference call, no writes
- explicit durable preference with grounded quote → saved with evidence + reason
- quote not present in user text (hallucination) → dropped
- quote present only in an assistant message → dropped
- duplicate statement → reinforced, not duplicated
- changed decision → history entry kept, new value saved, confidence not inflated
- malformed/truncated model output → no writes, no throw
- E2B caps and stricter gate enforced; E4B baseline enforced
- deleting an entry removes its links (store + graph data)
- legacy entries without new fields survive rehydrate untouched
- graph data contains only `explicit` + `discussed_together` links, each with an explanation

## 4. Performance and battery

Unchanged inference cost (same single extraction pass, same 320-token budget, same idle-drain queue). Grounding is O(transcript chars) string work. Graph link count drops sharply → less force-sim and render work per open. No new dependencies, no cloud, no telemetry.

## 5. Risks

- Stricter gates + grounding will save *fewer* memories. That is the spec ("better to save nothing than a bad memory"), but the graph grows slower.
- Small models may fail to produce verbatim quotes reliably → fact drop rate on E2B could be high. Mitigation: 0.8-token-containment fallback tolerates minor paraphrase; conservative failures are silent no-ops that retry on later conversations.
- Sparser links may loosen the visual volume; scene force constants may need one tuning pass.

## 6. Acceptance criteria

- No code path can write a memory whose evidence is not grounded in a user message.
- Every new memory answers "why" (evidence + reason) in the detail sheet.
- Memories are listable, editable, deletable, and toggleable in the shipped UI.
- Graph shows only explainable relationships; stats are honest.
- All Jest tests green; `tsc --noEmit` clean; existing user data survives rehydrate.
