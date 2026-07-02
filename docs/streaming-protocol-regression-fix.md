# Streaming Protocol Regression Fix

Date: 2026-07-02

## Root Cause

The regression was a parser/render-state boundary issue, with prompt pressure as a secondary contributor.

After the Clarifying Questions and Copy Blocks work, Aether had UI protocols for:

- clarifying questions: `{"__aether_question": true, ...}`
- copy deliverables: `<copy>...</copy>`
- copyable code: fenced code blocks

The streaming path still appended every native token directly into the visible assistant message. Question JSON was only normalized in `finishAssistant`, `stopGeneration`, or render-time legacy healing. Copy and fence segmentation happened in `MessageBubble` after the content was already visible. The render layer also used a broad pending-response heuristic: if an in-progress assistant message started with `{`, it was hidden until finalization.

That combination caused two bad behaviors:

- internal protocol could briefly enter visible `message.content` before the renderer classified it;
- legitimate normal responses beginning with JSON were blanked/delayed because `{` was treated as suspicious by itself.

The prompt also globally taught the model the control formats. That was not enough by itself to cause the flash, but it increased the chance that ordinary turns would spend early tokens on protocol-like output.

## Architectural Fix

The streaming boundary now lives in the chat store instead of the render layer.

- `messageParse.projectAssistantStream(raw)` projects raw generated text into safe visible content on each token.
- `useChatStore` keeps an in-memory `assistantStream.raw` buffer for the active assistant turn.
- `message.content` receives only the projected visible content.
- `finishAssistant` and `stopGeneration` finalize from the raw buffer, so partial question/copy protocol can be salvaged without ever persisting raw debris.
- `MessageBubble` no longer hides ordinary pending text just because it starts with `{`.
- `messageModelText` strips copy protocol from model history, while question history remains natural-language.
- The system prompt now explicitly says ordinary chat should not emit JSON/tags/control text unless a listed UI rule applies.

## Streaming Behavior

Normal prose is immediate: if the token stream does not contain the exact question marker or an exact prefix of a known Aether protocol opener, the projected content is the raw content.

Known protocol is hidden narrowly:

- exact question opener prefixes are held only while they still match the Aether question format;
- complete question JSON becomes `message.question`;
- partial `<copy`, `</copy`, and one/two backtick fence prefixes are held;
- normal JSON, arrays, HTML-like text, and fenced code become visible as soon as they diverge from Aether protocol.

Finalization is now cleanup only. It should not suddenly replace already-shown normal prose.

## Structured Feature Safety

Clarifying Questions:

- raw `__aether_question` JSON is hidden during streaming;
- complete payloads become `message.question`;
- malformed/truncated payloads salvage a plain question text when possible;
- repeated questions are demoted and the live `question` field is cleared.

Copy Blocks:

- partial `<copy` and partial closing tags do not flash;
- live opened blocks still render through the existing `segmentMessage(..., { streaming: true })` path;
- closed copy blocks remain tagged in persisted visible content so they render as copy cards after restart;
- unclosed copy blocks are finalized as plain text, with no raw `<copy>` debris and no premature copy action.

History:

- question JSON does not reach model history;
- `<copy>` tags do not reach model history;
- ordinary code fences remain normal user-facing markdown/code.

## Files Changed

- `app/src/llm/messageParse.ts`
- `app/src/state/useChatStore.ts`
- `app/src/components/chat/MessageBubble.tsx`
- `app/src/llm/prompt.ts`
- `app/src/llm/messageParse.test.ts`
- `app/src/state/useChatStore.test.ts`
- `app/src/components/chat/MessageBubble.test.tsx`
- `docs/streaming-protocol-regression-fix.md`

## Tests Added

Coverage was added for:

- ordinary prose streaming before finalization;
- monotonic visible prose;
- question control JSON never entering visible streaming content;
- normal JSON/code not being swallowed or misclassified;
- pending normal JSON rendering instead of blanking;
- question payloads becoming structured state;
- partial/malformed question cleanup on stop/error;
- copy protocol prefix hiding;
- unclosed copy-block terminal cleanup;
- copy protocol stripping from model history;
- normal fast-path projection avoiding protocol parse results.

## Test Results

Passing:

- `npm.cmd test -- --runInBand src/llm/messageParse.test.ts`
- `npm.cmd test -- --runInBand src/state/useChatStore.test.ts`
- `npm.cmd test -- --runInBand src/components/chat/MessageBubble.test.tsx`
- `npm.cmd run typecheck`

Full suite:

- `npm.cmd test -- --runInBand` ran 412 tests.
- 411 passed.
- 1 unrelated pre-existing Second Brain graph layout test failed:
  `src/components/secondbrain/graphData.test.ts`, expected `zSpread > 24`, received `13.96572412323534`.

## Real-Device Checks For E2B And E4B

Run these on both Gemma 4 E2B and Gemma 4 E4B before declaring the product path fully verified:

1. Normal prose: ask `Give me a friendly two-sentence explanation of why sleep matters.` Confirm text starts immediately with no raw JSON/control/code flash and no 1-2 second blank.
2. JSON start: ask `Reply only with this JSON object: {"answer": true, "items": [1, 2]}`. Confirm `{`/JSON appears during streaming before finalization and is not swallowed.
3. Array start: ask `Reply only with this array: ["alpha", "beta"]`. Confirm it streams normally.
4. Angle start: ask `Reply only with this React Native snippet: <View><Text>Hello</Text></View>`. Confirm it appears after the opener diverges from `<copy>` and does not disappear.
5. Code fence: ask for a TypeScript or shell code block. Confirm no raw fence flicker beyond the intended code card and the content remains visible.
6. Clarifying question: ask an underspecified task such as `Write an email for me` with no recipient or tone. Confirm no JSON flashes and the question card appears correctly if the model asks.
7. Copy Block: ask for a paste-ready email, caption, or shell command. Confirm no `<copy>` tag flash, the card fills live, and the copy button appears only after completion.
8. Unclosed Copy Block: start a long paste-ready deliverable, stop generation mid-block, and confirm no raw `<copy>` or partial closing tag persists.
9. Error/interruption: background/interrupt during a long structured response, reopen the chat, and confirm no protocol debris is visible or persisted.
10. History sanity: after a question card and a copy block, send a normal chat follow-up. Confirm the model does not continue emitting control JSON/tags unless the new task calls for it.

