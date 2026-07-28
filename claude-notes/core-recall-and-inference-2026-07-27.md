# Core recall and inference tuning (2026-07-27)

Two follow-ons Adam asked for in the same session: improve the path that gets saved memories
back into a chat, and make the models feel less stupid.

## Recall was losing real matches to grammar

`selectRecall` scores a memory by distinctive-token overlap with the message. The comparison was
exact-token, so ordinary English inflection broke it:

- "I want to **climb** this weekend" did not recall a note saying "loves **climbing**".
- "how are my **projects**" did not match a note about a **project**.
- "how is my **study** going" did not match "**studies** architecture".

Every one of those is a match a user would expect Core to make, and it was being dropped
silently — no signal that anything was missed.

`stemToken` now applies shallow morphological normalisation to both sides of every comparison:
`-ies` to `-y`, the `-ses/-xes/-zes/-ches/-shes` plurals, a bare trailing `-s` on words longer
than three characters that do not end in `ss`, and `-ing`/`-ed` on longer words with the doubled
final consonant undone (`running` to `run`).

The rules are deliberately shallow, and the reason they can afford to be is that both the
message and the note are stemmed identically — an imperfect stem still matches itself. The only
real hazard is two genuinely different words collapsing onto one stem, which is why nothing
short is touched and the verb endings require a long word.

The recall disclosure would otherwise have started naming stems, so `surfaceMap` keeps a
stem-to-original mapping per entry and the "matched: …" line shows the note's own wording.
`MemoryExtractor`'s known-facts ranking calls `distinctiveTokens` too, so its relevance
selection gets the same improvement without any change there.

Verified with a throwaway spec: gerund-versus-verb, plural-versus-singular, the disclosure
naming "studies" rather than "studie", and a low-information message ("thanks, that was
helpful") still recalling nothing. Deleted afterwards under the standing no-proactive-tests
rule. Two existing assertions in `recall.test.ts` were updated because they asserted the
pre-stemming output (`holes`, `thanks`); no behavioural test needed changing, which is a good
sign that the change is additive.

## Inference: what was actually wrong

Adam's report was that the models are stupid. Two things here were making that worse than it
needs to be. Neither makes a 2B model into a large one — the weights are the ceiling and nothing
in this repo moves it.

**Sampling was set for creative generation.** `TEMPERATURE = 1.0`, `TOP_K = 64`,
`TOP_P = 0.95` — Gemma's published defaults, matching Google's AI Edge Gallery demo. Those are
open-ended text-generation settings. On a small model doing assistant work they produce drift,
invented detail and self-contradiction, which is exactly what reads as stupidity. Now 0.7 / 40 /
0.9. Research and Core extraction pass their own lower temperatures explicitly and are
unaffected.

This is the highest-leverage change available on-device and it is also a judgement call, not a
measurement. It needs a side-by-side on hardware before it is treated as settled; the three
constants are together at the top of `LiteRtService.ts` and are trivial to revert.

**The system prompt was not counted against the context window.** `trimToContext` budgeted
`nCtx * 4 * 0.6` for history, while the system prompt — persona plus the whole Core notes block
— is sent alongside that history and was never subtracted. A long conversation with a full Core
block could therefore push the real prompt past the native window, and what the engine drops in
that situation is not something the app chooses. That is a plausible mechanism for an assistant
that quietly degrades the longer a chat runs.

`trimToContext` now takes `systemChars` and subtracts it, with a floor so history can never be
squeezed to nothing. The characters-per-token estimate also moved from 4 to 3.6: Gemma's
tokenizer averages closer to that on prose and worse on URLs, code and snake_case keys, and an
over-estimate errs in the direction that overflows.

## State

Strict typecheck clean. Jest 47 suites / 606 tests green.

Nothing here is device-verified. The context-accounting fix is arithmetic and safe to trust; the
sampling change is a considered default that genuinely needs Adam to compare replies on the S25
before it is called an improvement.

## Not done

Recall still ignores a note's `evidence` — the verbatim user quote — when scoring. Including it
would raise hit rate and would also broaden matching considerably, and restraint is the
deliberate design of this module, so it should be a measured decision rather than a guess.

The `MemoryInjector` note format (`- category / key: value`) still spends tokens on snake_case
keys. Changing it is taste, not a defect, so it was left alone.

Raising `MAX_TOKENS` above 4096 would help long chats more than any of this, but it is native
LiteRT configuration with real memory consequences on the 8 GB Poco X3 Pro, and it cannot be
evaluated without a device.
