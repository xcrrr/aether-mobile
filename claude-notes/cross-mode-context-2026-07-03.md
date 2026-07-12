# Cross-mode conversation context — P0 fix (2026-07-03)

Real bug: Research → Task in the same conversation lost everything. "What
happened to Oliver Tree?" (Research) → "Make a document about why he died"
(Task) → Task had no idea who "he" was and no idea what Research found.

## Root cause

`TaskContext` (`app/src/agent/types.ts`) carried only `goal` (the raw last
utterance), file attachments, and prior Task-created artifacts. Zero
conversation history, zero Research findings. `useInference.act()`
(`app/src/hooks/useInference.ts`) built it that way — never read `messages`
beyond attachment extraction. Research's own findings (sources/citations/query)
only ever existed as rendered markdown inside `Message.content`; nothing
structured was kept after the bubble rendered.

## Fix

- `Message.research?` (types/index.ts) + `useChatStore.setAssistantResearch()`:
  Research now persists `{query, answer, sources}` structurally on the
  assistant message, not just as markdown text.
- `agent/context.ts` (new): `buildConversationContext(messages)` — bounded
  recent turns + the most recent structured research handoff, sanitized via
  the existing `webresearch/safety.ts` trust boundary.
- `TaskContext.conversationContext?: string` (agent/types.ts) carries that
  block into every Task/refine model call.
- `agent/prompts.ts`: `buildStepPrompt`, `buildArtifactPrompt`,
  `buildRevisePrompt`, `buildFinalAnswerPrompt` all splice it in (clamped to
  each call's own budget) with one shared grounding rule: resolve references
  from it, but never let something it merely assumes become an invented fact
  if the gathered DATA doesn't support it. Same instruction everywhere, one
  system, not a second competing context path.
- `useInference.act()` builds `conversationContext` from the pre-goal
  `messages` (same capture point `research()` already used) and puts it on
  `ctx`.

## Also fixed while tracing the runtime

- **GPU reporting bug** (`LiteRtModule.kt`): the cache-hit fast path in `init()`
  hardcoded `"gpu":true` regardless of what backend actually loaded. Now
  echoes the real last result (`lastGpu`).
- **Dev-only diagnostics** (`LiteRtService.ts`): `[LiteRtDebug]` log
  (`__DEV__`-gated) on every `generate`/`extract` — backend, prompt/output
  token estimates, latency, tokens/sec, labeled by caller (`chat`,
  `research-contextualize`, `research-answer`, `task`, `title`,
  `core-extract`). Counts/flags only, never prompt text or Core values.
- **Dead context-budget code wired in**: `trimToContext` (prompt.ts) existed,
  tested, never called — Chat sent its entire unbounded history every turn
  with no bound against the engine's fixed `maxNumTokens` (4096). Now
  `send()` trims to `Llama.MAX_TOKENS` before `generate()`. `MAX_TOKENS` is
  now exported from `LiteRtService.ts`.

## State

Typecheck clean, 38/38 suites, 500/500 tests (unchanged baseline — this pass
didn't add tests; user wants to test this one manually). Native Kotlin change
is un-compiled/un-verified here (no Android toolchain on this machine) — needs
a real device build + the Oliver Tree flow run by hand before calling it done.

## Not done / explicitly out of scope this pass

- Did not raise `MAX_TOKENS`/model `contextLength` (both 4096, matching
  `models/registry.ts`) — no device to verify memory/latency headroom. Real
  Gemma context capacity may be higher; raising it blind violates the
  "verify on real hardware first" rule.
- Didn't touch onboarding, website, or any UI/visual work (out of scope per
  this pass's brief).
