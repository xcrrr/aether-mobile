# Core extraction pass (2026-07-27)

Follow-on from `core-visible-nodes-2026-07-27.md`. Adam asked for the 50-fact limit to go and
for extraction to be upgraded. Five defects were found in `src/secondbrain/MemoryExtractor.ts`;
all five are fixed. This is a real improvement, not a finished feature — the open items are at
the bottom and they are not small.

## 1. The known-facts list showed the wrong facts, and could overflow the context

`buildKnownFacts` was `entries.slice(0, 50)`. Two separate problems live in that one line.

`slice` takes *insertion order*, so past fifty memories the model was shown the fifty OLDEST
facts and never the ones actually being discussed. This block exists for exactly one purpose —
"do NOT output any of these again ... reuse the EXACT same key shown" — so showing the wrong
fifty produces the precise failure it was meant to prevent: a known fact re-emitted under a
fresh key, saved as a second copy.

The count cap also does not bound what it was supposed to bound. Values are stored up to 200
chars, so fifty facts can be over 10,000 characters. On top of a 4,000-char transcript and a
~2,000-char template, inside a 4,096-token window with 380 tokens reserved for the completion,
that overflows — and an overflowed extraction returns nothing, silently, so Core simply stops
learning for heavy users with no visible symptom.

The budget is now characters (`MAX_KNOWN_FACT_CHARS = 4000`) with per-line value trimming, and
selection is relevance-first: distinctive-token overlap against the conversation's user text
(reusing `distinctiveTokens` from `recall.ts` rather than inventing a second scorer), then
fresh-before-stale, then most recently seen. Chosen facts are rendered grouped by category and
sorted by key so the block looks the same every turn.

In practice this shows *more* facts than before for a normal user — a typical line is about 65
chars, so roughly sixty fit — while bounding the worst case. Measured with 200 saved memories
at maximum value length and a full transcript, the whole prompt stays under 11,000 characters
(~2,750 tokens); the same input under the old code was over 40,000.

## 2. User text could rewrite the prompt through `$` substitution

`PROMPT_TEMPLATE.replace('{KNOWN_FACTS}', buildKnownFacts())` used string replacements. In
JavaScript the *replacement* string is scanned for `$&`, `` $` ``, `$'` and `$$`, which
substitute the match and the surrounding text. Both blocks spliced in here are user-controlled:
saved memory values, and the raw conversation transcript. A message containing `` $` `` would
duplicate everything before the placeholder into the prompt body.

Both are now function replacements, which receive no substitution scanning. This was reachable
by typing an ordinary-looking string into chat.

## 3. Capitalised link endpoints were silently dropped

`validateEntry` normalises a fact key with `.toLowerCase().replace(/\s+/g, '_')`. `parseLinks`
did not, so a link written as `{"from_key": "Business Name"}` never matched the stored
`business_name` and was discarded by the endpoint check without a trace. Links are the graph's
only *explicit* relationships — every other edge tier is derived — so losing them costs real
structure.

Endpoints now go through the same `normalizeKey` helper both paths share, and self-links are
dropped.

## 4. Canonicalised keys orphaned their own links

`canonicalKeyFor` and deletion authority can both store a fact under a different key than the
model emitted (`marathon_schedule` saved as `marathon_date`). The links in the same response
still referred to the model's name, so the endpoint check failed and the link vanished —
reliably, every time a key was canonicalised, which is exactly when the fact was interesting.

The apply loop now records a model-key to stored-key map and link endpoints resolve through it.

## 5. Per-pass fact caps were discarding validated facts

`maxFacts` was 5 (E4B) and 3 (E2B). Candidates are confidence-sorted and already had to pass
both the model's confidence and the mechanical grounding gate, so anything the cap removed was
a fully validated, verbatim-grounded fact being thrown away. The cap should only be protecting
the token budget, and at 380 completion tokens there is room for roughly eight facts.

Raised to 7 (E4B) and 4 (E2B), links to 4 and 3. `minConfidence` is untouched at 0.7 / 0.8 —
quality is still the gate's job, not the cap's. The two policy assertions and the E2B volume
test were updated, and that test now also asserts the fifth candidate is rejected by the
confidence gate rather than by the cap.

## State

Strict typecheck clean. Jest 47 suites / 600 tests green.

The new selection logic was verified with a throwaway spec covering all three of: relevant and
recent facts surviving past 50 while the oldest are dropped, the whole prompt staying inside
the context budget at 200 long memories, and a `$`-pattern in a saved value reaching the prompt
intact. That spec was deleted afterwards under the standing no-proactive-tests rule; it is
worth re-adding on request, particularly the prompt-corruption case.

Nothing here is device-verified. There is still no Android toolchain on the Linux laptop
(`java` absent from `PATH`), so no APK was built and no extraction has been run against live
Gemma output.

## Still open — this is not "perfect"

**Auto-extraction preemption is the big one.** `app/CLAUDE.md` records it as a known issue and
it is still true: auto-extraction fires after each reply and is preempted the moment the user
sends the next message, so on a fast conversation the reliable path remains the manual "Analyze
now" button. Fixing it means changing how the single serialized LiteRT session arbitrates
between chat and extraction — queueing extraction against idle time rather than racing the next
turn. That is an architecture change, not a tuning change, and it cannot be validated without a
device.

**`MAX_EXTRACT_TOKENS = 380`** is what really bounds facts per pass. It was chosen small so a
truncated JSON array (which parses to nothing) is less likely. Raising it raises both capture
and the preemption risk above; the two are coupled and should be decided together, on hardware.

**Extraction quality is unmeasured.** Every gate here is mechanical — verbatim grounding,
confidence thresholds, key normalisation. Nothing measures whether the facts Gemma proposes are
the *right* facts. There is no fixture set of real conversations with expected extractions, so
no prompt or policy change can currently be shown to be an improvement rather than a change.
That is the single highest-value thing left for Core, and it needs Adam's real conversations.
