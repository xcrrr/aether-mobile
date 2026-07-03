# Core profile recall fix (2026-07-03)

Bug: "Who am I? / What do you know about me?" answered as if Core was empty.
Root cause: those questions are 100% stopwords → `distinctiveTokens` → zero tokens → `selectRecall` returned nothing → no memory section in the prompt. Storage/injection were fine.

Fix (recall.ts + MemoryInjector.ts):
- New deterministic profile route: broad self-context questions (`PROFILE_BROAD`) and asked facets (`PROFILE_ASK` + `PROFILE_FACETS`) select a bounded round-robin across categories (identity→personality; emotional/patterns never volunteered), same per-model count/char budgets.
- `RecallResult.profileQuery` flag → injector appends "summarize only the notes above" when notes exist, or an honest "no saved Core notes yet" instruction when none do.
- Fast/Thinking share `send()` → both modes covered. Core disabled → `EMPTY_RECALL`, nothing injected.

Tests: recall.test.ts + MemoryInjector.test.ts profile blocks. 494/494 green.
