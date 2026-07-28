# Research audit (2026-07-27)

Requested by Adam after using Research on the S25 Ultra. His report: it looks like AI slop, it
still works badly, it is safe, and it sometimes reads one or two sources instead of three.

Every finding below was read directly from the source on this laptop. Nothing here is measured
on a device, because there is no Android toolchain here — where a claim depends on runtime
behaviour rather than code structure, it says so.

The security assessment stands: `safety.ts` is a real chokepoint, the SSRF gate is applied at
both the search-result and fetch boundaries, redirects are re-validated against the final URL,
and Gemma control tokens are stripped from every piece of web text before it reaches a prompt.
Adam's "it's safe" is correct and nothing in this audit weakens it.

## Why it reads one or two sources instead of three

`MAX_SOURCES = 3` is a cap on how many results are *searched*, not a floor on how many are
*delivered*. The pipeline in `ResearchEngine.runResearch` is:

```
searchDuckDuckGo(query, 3)   ->  3 URLs
Promise.all(fetchAndClean)   ->  3 FetchedSource
filter(s => s.content !== '') ->  however many survived
```

`fetchAndClean` returns an empty-content source, never an error, on any of: non-OK HTTP status,
a `content-type` that isn't HTML/plain/xhtml, the 5-second timeout, a redirect that lands on a
private host, or `cleanHtml` extracting nothing from a JavaScript-rendered page. Every one of
those is a permanent loss — **there is no top-up.** One failure gives two sources, two failures
give one. That is exactly the reported symptom, and it is structural, not intermittent.

The wasteful part is that DuckDuckGo returns far more results than three; `parseSearchHtml`
simply discards them because it was asked for three. The information needed to recover was
already fetched and thrown away.

The fix is over-fetching: ask the search layer for a larger candidate pool (eight is plenty),
then fetch until three sources have real content. Prompt size does not change — only the three
that succeed are used, and `PROMPT_CONTENT_CHARS` already caps each one — so this costs network
time on failures only, not model time.

Two related contributors:

`FETCH_TIMEOUT_MS = 5000` is shared between the search request and the page fetches. Five
seconds is tight on mobile data, so a slow-but-good source is dropped as if it were dead. With
over-fetching this matters much less, which is an argument for doing over-fetch first rather
than tuning the timeout.

There is no fallback and no retry if DuckDuckGo itself fails. When DDG serves a rate-limit or
challenge page, `parseSearchHtml` finds no `result__a` matches, returns `[]`, and the user sees
"I couldn't find usable sources for that query. Try rephrasing it, or check your internet
connection." That message is indistinguishable from a genuine no-results answer, and it blames
the user's phrasing for what is actually the search endpoint refusing us. How often this
happens in practice is unmeasured and needs a device.

## The citation machinery contradicts itself and is dead

`buildResearchPrompt` instructs the model: *"Do NOT write citation numbers like [1] in your
text."* `extractCitations` then scans the answer for exactly `[n]` markers to build the citation
list. When the model obeys the prompt, that list is empty; `stripCitationMarkers` exists to
remove markers the prompt already forbade.

It does not matter either way, because nothing consumes `result.citations`.
`formatResearchMarkdown` ignores it entirely and lists every source unconditionally. Outside
`ResearchEngine.ts` and its own tests, the field has no readers anywhere in the app.

The consequence is worth stating plainly: **Research currently has no per-claim attribution.**
The user gets a block of prose and a flat list of three links, with no way to know which source
supports which sentence. For a research feature that is the entire value proposition, and it is
missing by design conflict rather than by oversight.

This needs a decision rather than a patch. Either inline citations come back and get rendered
as tappable markers, or the citation extractor, the marker stripper, and the `Citation` type all
go. Keeping non-functional citation code is worse than either.

## Why it looks like AI slop

**There is no Research UI. Not a weak one — none.** `src/components/chat/` contains
`AgentTaskCard.tsx` and `AgentLiveCard` for Task, `QuestionCard`, `CopyBlock`,
`AttachmentChip`. There is no research component of any kind. Everything Research shows is text
pushed into an ordinary assistant message bubble.

**Progress is markdown italics written into the message body.** In `useInference.research`:

```ts
(status) => setContent(`_${status}_`)
```

So "Reading sources 2/3" renders as italic serif prose in the position the answer will occupy.
There is no spinner, no per-source rows, no domains, no favicons. The user cannot see *what* is
being read — only a counter — and the counter is styled like the assistant talking.

**The result is a markdown blob.** `formatResearchMarkdown` produces:

```
{answer}

---

**Sources**
1. [Title](url)
2. [Title](url)
```

A horizontal rule, a bolded word, and a numbered list of raw markdown links rendered with
`link: { color: c.purple }`. That specific pattern — `---` then `**Sources**` then numbered
links — is the canonical generic-LLM output shape. It is what Adam is reacting to, and he is
right. There are no cards, no domains shown separately from titles, no favicons, no deliberate
tap targets, nothing that reads as a designed surface. Measured against
`ModelLoadingOverlay.tsx`, which `app/CLAUDE.md` names as the quality bar, it is not in the
same product.

**The structured data for a proper UI already exists and is being discarded.**
`useInference.research` calls `setAssistantResearch({ query, answer, sources })`, and
`Message.research` is a persisted field on the message. Its only consumer in the entire app is
`src/agent/context.ts` — the Task agent, which is hidden behind `TASK_UI_ENABLED = false`. So
today that payload is computed, persisted to disk, and read by nothing the user can see.

This is the most useful finding in the audit: a real Research result surface needs **no new
plumbing**. The query, the answer and the source list are already on the message, already
persisted, already surviving a restart. It is a rendering job.

**Things the result never shows that it already knows.** The contextualised query is never
displayed — if `contextualizeQuery` rewrote "are you sure he died?" into something else, that
rewrite is what was actually searched and the user has no way to see it or correct it. There is
also no timestamp, no re-run affordance, and no in-app way to open a source.

**The mode picker is fine.** `ModeMenu.tsx` is well-built — proper tokens, a real description
per mode, a selected state. It is not the problem and should not be touched.

## Smaller things found while reading

During streaming, `onAnswer` writes the raw model text into the bubble, so any `[n]` markers the
model does emit are visible while it types and then disappear when `stripCitationMarkers` runs
on completion. A visible flicker on every research answer that includes a marker.

`contextualizeQuery` runs a full model round-trip with `preempt: true` before the search on
every follow-up, adding latency to the slowest part of the flow and preempting whatever was in
flight. Its output is only checked for emptiness (`rewritten || query`), so a nonsense rewrite
is searched as-is.

`RESULT_A` and `SNIPPET` in `DuckDuckGoSearch.ts` are module-level `/g` regexes carrying
`lastIndex` state across calls. `parseSearchHtml` resets `RESULT_A` but `SNIPPET.lastIndex` is
only ever set inside `snippetAfter`. It happens to work; it is fragile in a way that will
eventually produce a mystery bug.

## Recommended order

1. **Over-fetch so three sources are actually delivered.** Bounded, testable without a device,
   fixes the concrete functional complaint. Small.
2. **Build the Research result surface.** A progress component showing each source as it is
   read (domain, title, state) and a result component rendering `message.research` as source
   cards instead of a markdown list. This is the "looks like slop" fix and it is the larger
   piece of work. No new data plumbing required.
3. **Decide the citation question** — render inline attribution properly, or delete the dead
   machinery. Needs Adam's call, not a default.
4. **Search resilience** — distinguish "the search engine refused us" from "there are no
   results", and retry or refine rather than blaming the user's phrasing.

Items 1 and 2 together are what would make Research feel like a real feature. Item 3 is what
would make it a *research* feature rather than a web-flavoured chat reply.
