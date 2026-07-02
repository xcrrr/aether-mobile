# Conversation Interaction Engine — Verification

Date: 2026-07-01. Companion to `conversation-interaction-engine-plan.md`.

## Automated verification (run and passing)

- `npm run typecheck` — 0 errors (TypeScript strict).
- `npm test` — **302 tests, 26 suites, all passing** (was 253 before this work; +49 new).

### New/extended suites and what they prove

`src/llm/messageParse.test.ts` (31 tests)
- Question parsing: bare JSON, ```json fence, surrounding prose, streaming partials return null, empty/non-string options rejected, trailing-comma tolerance, `"true"` string marker, braces inside option labels.
- `extractQuestion`: prose before AND after the JSON is preserved; emptied fences removed.
- `finalizeAssistantText`: valid question → structured + prose kept; truncated JSON → question text salvaged; unsalvageable junk → stripped, prose kept; the marker can never reach rendered content; appended error lines survive.
- Segmentation: raw payload fidelity (indentation, blank lines), multiple blocks, ordering; streaming mode turns a trailing unclosed `<copy>`/fence into a `pending` block; closed blocks never pending; non-streaming mode unchanged.
- History rewriting: question turns become natural language, never JSON; legacy raw-JSON messages converted; user/normal messages untouched.
- `sameQuestion` normalization.

`src/state/useChatStore.test.ts` (8 tests)
- `finishAssistant` finalizes: structures questions, keeps prose, salvages malformed JSON.
- `stopGeneration` finalizes the partial reply (no raw JSON persisted, `stopped` set, `isGenerating` false).
- Duplicate question → demoted to plain text; a *different* follow-up question is not.
- `recordQuestionAnswer` persists and is idempotent (double-answer impossible).
- Normal replies pass through byte-identical.

`src/components/chat/MessageBubble.test.tsx` (12 tests)
- **Regression:** finished message with broken question JSON never shows the typing indicator (the old permanently-stuck-chat bug).
- **Regression:** finished empty reply never shows the indicator.
- Mid-stream question JSON hides behind the indicator; prose streamed *before* the JSON stays visible.
- Prose + question card render together (nothing lost).
- Legacy persisted raw-JSON messages self-heal into a card at render.
- Option tap passes `(option, messageId)`; QuestionCard double-tap guard; persisted pick renders highlighted and locked; answered card ignores taps.
- CopyBlock hides the copy button while `pending`, shows it when complete.

## Brief acceptance cases — status

| # | Case | Status |
|---|---|---|
| 1 | Direct answer, no needless question | Prompt policy rewritten (restraint, stated assumptions); needs on-device confirmation |
| 2 | Material ambiguity → one question | Prompt: one question max, ask-first; on-device |
| 3 | Useful distinct options | Prompt wording; on-device |
| 4 | Option selection → durable context | Proven by tests (persisted answer + natural-language history) |
| 5 | Custom typed answer while card visible | Input is never blocked by a card (unchanged path); card locks via `!isLast` once any message follows — proven by test |
| 6 | No answer-then-question duplication | Prompt forbids mixing; if it happens anyway, both render (nothing lost) — proven by test |
| 7 | No repeated clarification | History rewrite + prompt + deterministic demotion — demotion proven by test |
| 8 | Double-tap / duplicate answers | Proven by tests (ref guard + idempotent store) |
| 9 | Interrupted generation never traps the chat | Proven by tests (stop finalizes; indicator is state-driven) |
| 10–11 | E2B / E4B behavior | Same normalized contract; degradation proven at parser level; model compliance needs on-device |
| 12 | Normal prose not carded | Prompt: "never wrap explanations"; on-device |
| 13–16 | Copy fidelity (email/code/command/caption) | Raw-payload copying proven at parser level (indentation/blank-line test); clipboard byte-fidelity needs on-device |
| 17 | Multiple artifacts isolated | Proven by segmentation tests |
| 18 | Mixed prose + block | Proven by tests |
| 19 | Malformed structured output fails safely | Proven by tests (salvage, strip, never crash, never stuck) |
| 20 | Stream/stop/re-render no duplication | Store + pending-block tests |
| 21 | Persistence across lifecycle | Structured fields persisted via existing conversation storage; store tests cover write path; restart needs on-device |
| 22 | Accessibility / tap targets | Copy button labeled, hitSlop kept; options are full-width 44px-ish pills; screen-reader pass needs a real device |

## What is proven vs inferred

- **Proven by tests:** parser behavior, finalize-at-terminal, salvage, demotion, persistence write path, renderer state machine, copy payload fidelity at the data layer.
- **Inferred from code:** clipboard exactness (expo-clipboard passes the string through; no markdown reconstruction anywhere in the path), FlatList behavior with the new props.
- **Not yet verified:** actual E2B/E4B compliance with the rewritten prompt, on-device visuals, haptics, screen reader.

## Manual on-device verification steps

Build and install, then with **each of E2B and E4B**:

1. "Explain black holes." → normal streamed answer, no card, no indicator flicker.
2. "Write me an email" → expect either one question card (2–4 distinct options) or a direct draft with a stated assumption. Never both an answer and a card contradicting it.
3. Tap an option → it appears as your message; reply uses the choice; the card locks with your pick highlighted. Kill the app, reopen: pick still highlighted.
4. Ask something that triggers a question, then **type** a custom answer instead of tapping → conversation continues naturally; card locks.
5. Trigger a question, hit **Stop** while the JSON is streaming (watch for the indicator, stop then) → chat shows salvaged question text + "(stopped)", input still usable, no stuck indicator. Restart app: still fine.
6. "Give me a bash command to list large files" → code card with copy button appears *while streaming* (no raw ``` text flash); copy button appears only at the end; paste into a notes app → byte-exact.
7. "Write an Instagram caption with emojis, then explain why it works" → `<copy>` card + prose both render; copied caption exact incl. emoji.
8. Answer a question card, then ask a similar request again → model should not re-ask the answered detail; if it does, the repeat renders as plain text, not a second card.
9. Airplane-mode research / model-unload errors → error text renders as a normal message, chat recovers.

Record screenshots into `design-artifacts/` per design rules.

## Known limitations (honest)

- The model can still *choose* to ask a mediocre question; the prompt shapes this but cannot guarantee it. The deterministic layer only guarantees the UI never breaks and repeats never stack cards.
- Nested ``` inside a fence or a literal `</copy>` inside a copy body terminates the block early.
- Duplicate-question demotion uses normalized text equality; a reworded repeat won't be demoted (the prompt + rewritten history is the real defense).
- A `{`-opening *normal* reply (rare) hides behind the indicator until finish instead of streaming live. Chosen deliberately over flashing raw JSON.
- `title`/`extract` prompts still use single-turn `buildGemmaPrompt` wrappers — untouched, out of scope.
