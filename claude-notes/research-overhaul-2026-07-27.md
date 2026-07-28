# Research overhaul (2026-07-27)

Implements every item from `research-audit-2026-07-27.md`. Adam asked for all four fixed at
once and named Research as equal in importance to Core.

## Three sources are now delivered, not merely attempted

`MAX_SOURCES = 3` was being used as the number of results to *search*, and every fetch failure
was a permanent loss — which is why answers routinely came back with one or two sources.

`SEARCH_CANDIDATES = 8` is now the search width, and `gatherSources` reads candidates in waves
of five until three have real content. A wave is fetched in parallel, so the wall-clock cost of
a failure is nothing extra; only the sources that succeed reach the prompt, so prompt size and
model time are unchanged. Worst case is two waves.

`PAGE_TIMEOUT_MS = 9000` splits page reads from the search request, which keeps
`FETCH_TIMEOUT_MS = 5000`. Five seconds was dropping slow-but-good pages on mobile data as
though they were dead; pages are read in parallel, so the extra headroom costs one timeout of
wall-clock, not one per source.

## The search layer now says why it came back empty

`searchDuckDuckGo` returned `[]` for "the web has nothing", "DuckDuckGo rate-limited us" and
"there is no network" alike, and the UI told the user to rephrase in all three cases. It now
returns `{ results, status }` with `ok | no-results | blocked | offline`, and an empty result
set from a working endpoint is retried once with a simplified query (`simplifyQuery` strips
quotes and punctuation and keeps the first ten words) before it is reported as no-results.

The four failure messages are now distinct, and none of them blames the user's phrasing for an
endpoint refusal. A separate message covers the case where results were found but every page
failed to open, which was previously indistinguishable from finding nothing.

## Citations are real now

This was the open decision in the audit. The prompt used to say *"Do NOT write citation numbers
like [1]"* while `extractCitations` scanned for exactly those markers, so the citation list was
almost always empty — and nothing consumed it anyway. Research had no per-claim attribution at
all.

The prompt now requires inline `[n]` markers bounded to the number of sources, the markers stay
in the displayed answer, and they line up with the numbered source cards. `stripCitationMarkers`
is gone, replaced by `dropUnknownCitations(text, sourceCount)`, which removes only markers that
point at a source that does not exist — an invented `[9]` against three sources would otherwise
render as a reference the reader cannot follow. It runs during streaming too, so a bad marker
never appears and then silently vanishes at the end.

`Message.research.sources[].cited` records which sources the answer actually used.

## The result surface

There was no Research UI at all before this — every part of it was text pushed into an ordinary
assistant bubble, including the progress line, which was written as markdown italics into the
message body.

- `src/state/useResearchStore.ts` holds live progress. Transient, never persisted, and modelled
  on `useAgentStore.liveTask` because that is the existing precedent for "a live process owns
  this message".
- `src/components/chat/ResearchCard.tsx` provides `ResearchLiveCard` (phase, the contextualised
  query, and one row per source showing its domain, title and whether it was read or failed) and
  `ResearchSources` (numbered source cards matching the inline markers, tappable to open).
- `MessageBubble` renders the live card while research runs and the source cards under a
  finished answer. The message body is now the answer and nothing else.
- Long-press copy still produces a numbered text list, via `formatResearchMarkdown` — a
  clipboard is the one place a markdown list is the right shape.

The structured payload this renders was already being written and persisted before today; its
only reader was the Task agent, which is hidden. No new plumbing was needed, only a surface.

`ResearchSources` also shows the contextualised query when it differs from what the user typed,
so a rewritten follow-up is visible rather than silent.

## Smaller fixes

`contextualizeQuery` now validates its rewrite (`isUsableQuery`) instead of only checking for an
empty string, so a model that answers or comments instead of rewriting falls back to the raw
query rather than searching prose.

`src/agent/tools.ts` flattens the structured progress into its own status-line channel.

## State

Strict typecheck clean. Jest 47 suites / 606 tests green, including new coverage for over-fetch
(four dead candidates, three good ones behind them), blocked-vs-no-results messaging, and the
all-pages-dead case.

**The visual result is unverified.** There is no Android toolchain on this laptop, so no APK was
built and nobody has looked at these components on a screen. The code follows the token system
and the existing card patterns, but "does not look like AI slop" is a judgement that has to be
made with eyes on a device, in both themes. That check is the remaining work on this.
