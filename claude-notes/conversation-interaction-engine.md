# Conversation Interaction Engine — note for Codex

Date: 2026-07-01. Author: Claude.

Clarifying Questions + Copy Blocks were hardened. Full docs:
`docs/conversation-interaction-engine-plan.md` and `...-verification.md`.

## Architecture change you should know about

Assistant messages are now **finalized** at every terminal transition (finish /
stop / error) by `finalizeLastAssistant` in `src/state/useChatStore.ts`, which
calls `finalizeAssistantText` in `src/llm/messageParse.ts`:

- Valid question JSON → structured `message.question` field; `content` keeps only
  the surrounding prose. Malformed/truncated JSON is salvaged into plain text.
  **Raw `__aether_question` JSON never persists in `content` anymore.**
- `message.questionAnswer` stores the tapped option (persisted highlight).
- `splitConversation` (LiteRtService) now maps history through
  `messageModelText` — question turns go to the model as natural language,
  never as JSON. If you touch history construction, keep that mapping.
- `MessageBubble` derives the typing indicator from `isGenerating && isLast`,
  never from content shape (the old stuck-indicator bug). It also heals legacy
  persisted raw-JSON messages at render.
- `segmentMessage(text, { streaming: true })` emits `pending` copy/code segments
  for trailing unclosed blocks so cards appear during streaming instead of raw
  markup flashing into a card.

## If you change the wire format

The prompt (`INTERACTION` in `src/llm/prompt.ts`), the parser
(`messageParse.ts`), and the tests (`messageParse.test.ts`,
`useChatStore.test.ts`, `MessageBubble.test.tsx`, `prompt.test.ts`) must move
together. 302 tests + strict typecheck are green as of this note.
