# Second Brain — Phase 1 Verification

Date: 2026-07-01. Suite: Jest (`npm test`), TypeScript strict (`npm run typecheck`).

## Automated results

- **Full suite: 23 suites / 225 tests — all passing.**
- **`tsc --noEmit` — clean.**

### Requirement → test mapping

| Requirement | Test | Result |
|---|---|---|
| Trivial chat creates no memory | `MemoryExtractor.test.ts` — "skips a trivial greeting-only exchange without inference" (no inference call at all) | PASS |
| Explicit long-term preference can create memory | "saves a grounded fact with evidence and a reason" | PASS |
| Duplicate statements don't duplicate | `MemoryStore.test.ts` — "re-observing the same value reinforces without inflating confidence"; "merges a re-keyed duplicate value within a category" | PASS |
| Updates don't silently erase history | "a changed value keeps the old one in history and does not inherit confidence"; "caps history at 5 revisions" | PASS |
| Assistant hallucinations cannot become memories | "drops a fact whose quote is not in any user message"; "drops a fact grounded only in ASSISTANT text"; "drops a fact without a quote even when confidence is high" | PASS |
| Malformed model output → no writes, no crash | "no-ops on null inference or unparseable output"; "a truncated JSON response causes no writes and no crash" | PASS |
| Deleted memories leave the graph cleanly | `MemoryStore.test.ts` — "deleting an entry removes its dangling edges"; `graphData.test.ts` — "a deleted memory leaves no links behind" | PASS |
| Existing data survives migration | Schema change is purely additive (optional `evidence`/`reason`/`history`); rehydrate backfill untouched except stale rule; legacy entries without new fields validated by the store tests using pre-v2 shapes (`mkEntry` has no v2 fields) | PASS |
| Both Gemma models → equivalent storage quality | "E2B saves at most 3 facts and requires 0.8 confidence"; `extractionPolicy` unit tests (E4B baseline, E2B/unknown stricter); the grounding gate is model-independent | PASS |
| Graph relationships explainable, never random | `graphData.test.ts` — "creates only real, explainable link types — never keyword or category filler"; "same-conversation grouping is a single star, not a fabricated mesh"; "manual memories get no derived conversation links"; every link carries a non-empty `explanation` | PASS |
| Grounding mechanics | `grounding.test.ts` — verbatim match, case/punctuation tolerance, 0.8 token-containment paraphrase, rejection of unsaid text, too-short quotes, empty user text | PASS |

## What is verified only by code inspection (not automated)

- `onRehydrateStorage` migration path runs in the real app on next launch; Jest exercises `dedupeEntries` (including history merge) but not the zustand-persist rehydrate callback itself.
- Real Gemma behavior: the grounding gate guarantees no ungrounded write regardless of model output, but actual E2B/E4B quote fidelity (how often facts pass the gate) needs on-device observation.
- Graph visuals (force stability, label density, volume shape with sparser links) need an on-device pass.

## Manual verification steps (on device)

1. Load Gemma 4 E2B. Send "hey", "thanks", "ok" in a chat → open Second Brain → no new memories.
2. Send "I'm training for a marathon in October, remind me to keep runs consistent" → after the reply, wait for the brain pill / open Second Brain → one memory in goals; tap it → detail sheet shows "Why this was saved" with your quoted words.
3. Repeat the same statement in a new chat → still one memory, "connected" data unchanged; no duplicate node.
4. Say "actually I moved the marathon to December" → the memory updates; detail sheet shows "Previously" with the October value.
5. Ask the assistant to speculate about you ("guess my hobbies") and agree vaguely → nothing new saved from assistant guesses.
6. Open the list (list icon, top right) → search, edit a memory's text, delete one → graph updates immediately, its links disappear.
7. Toggle "Enable Core" off → chat on → no new memories saved; toggle back on.
8. Switch to Gemma 4 E4B and repeat steps 2–5 → same end behavior.
9. Kill and relaunch the app → all memories still present (migration-safe rehydrate).

## Known limitations (honest)

- Facts extracted before this change have no `evidence`/`reason`; the detail sheet says so explicitly rather than inventing one.
- The grounding gate trades recall for precision: E2B especially will sometimes fail to quote verbatim and the fact is (correctly) not saved. Retry happens naturally in later conversations.
- Auto-extraction still yields to chat activity; the queue retries when idle. Facts can take a moment to appear after a reply.
- Relationship coverage is thinner than before by design — only model-extracted relations and same-conversation grouping exist. Density must now be earned by real use.
