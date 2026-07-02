# Conversation Interaction Engine — Plan

Owner: Claude (cofounder). Date: 2026-07-01.
Scope: Clarifying Questions + Copy Blocks. No new features, no redesign.

## 1. Current-state audit

### Wire protocol (both models, identical)
- System prompt (`src/llm/prompt.ts` `INTERACTION`) teaches two formats:
  - Clarifying question: reply with ONLY `{"__aether_question": true, "question": "...", "options": [...]}`.
  - Copyable artifact: fenced ``` code blocks and `<copy>...</copy>` for non-code deliverables.
- `src/llm/messageParse.ts`:
  - `parseQuestion(text)`: finds first `{` .. last `}`, `JSON.parse`, validates marker + shapes. Returns null until JSON parses (streaming-safe for the happy path).
  - `segmentMessage(text)`: regex-splits into `text | copy | code` segments. Copy/code content is the raw payload (never reconstructed from rendered markdown) — this part is sound.
- `MessageBubble.tsx`: re-parses raw `message.content` on every render. If `parseQuestion` succeeds → renders `QuestionCard` **instead of** the whole message. If content merely *contains* `__aether_question` but doesn't parse → shows `TypingIndicator`.
- `QuestionCard.tsx`: `picked` is local component state; `answered = !isLast`. Tap calls `onOptionSelect` → chat screen's `send(option)` → plain user message.
- History: `splitConversation` (LiteRtService) sends assistant content verbatim — including raw question JSON — back to the model as prior turns.

### Confirmed failure modes (ranked)
1. **Permanent typing indicator (broken chat state, persisted).** Any stream that ends with unparseable content containing `__aether_question` (stop mid-JSON, native error appended by `useInference` onError, app kill) renders `TypingIndicator` forever, because the indicator is derived from *content shape*, not generation state. Also: a reply that finishes empty (`!stripped`) shows the indicator forever. Survives restart because the raw content is persisted.
2. **Prose silently dropped.** If the model emits an answer *and* a question JSON (E2B does this), `parseQuestion` succeeds and the card replaces the entire message. User-visible answer text is destroyed. Violates "never lose useful content."
3. **Raw JSON echoed into model history.** The assistant turn stored/sent is the JSON blob. This (a) teaches the model to keep emitting JSON, (b) makes "Casual" as the next user turn harder to ground, (c) increases re-asking.
4. **Selection not persisted.** Navigate away/return or restart → picked highlight gone (local state).
5. **Prompt over-asks by design.** "Lean toward asking… better to ask than to build the wrong thing" is the opposite of the product policy (ask only when material; otherwise assume and state the assumption). No "ask first, never after an answer", no "never re-ask".
6. **Streaming copy-block flash.** An unclosed `<copy>` tag streams as literal `<copy>` text, then flips into a card at completion — the exact "text later replaced by a widget" feel we're banning. Unclosed ``` fences render as broken markdown mid-stream.
7. **Double-tap race.** `locked` check reads pre-render state; two fast taps can both pass. Low probability, cheap to guard.
8. **No model-specific constraints.** E2B and E4B share one prompt with no compliance guidance; parser has no tolerance for near-miss JSON (trailing commas etc.).

### What is already good (keep)
- Raw artifact payload is the copy source of truth (segment content → clipboard, never markdown-rendered text).
- `parseQuestion` returning null on partial JSON prevents raw-JSON flash during streaming.
- Copy UX: haptic + check + toast, horizontal scroll for code, verbatim rendering.
- Single-generation LiteRT seam, `appendToken` post-stop guard.

## 2. Architecture options

### Option A — keep render-time parsing, patch the bugs in place
Renderer keeps deriving everything from raw content; add more conditions.
- - State can still flip after the user saw it; every render re-parses; malformed content has no canonical repair point; legacy bugs re-appear with each new edge case. Rejected: treats symptoms, keeps content-shape-derived UI state.

### Option B — new strict protocol (control-token prefix + buffered structured replies)
Model must open with a control token; UI buffers whole structured replies; JSON never enters `content`.
- + Cleanest separation.
- - Requires re-teaching two small local models a new format (E2B compliance is the risk), breaks streaming feel for normal answers misclassified by the prefix, invalidates all persisted history, large diff. Rejected: reliability risk with local Gemma outweighs elegance; wire format is not the broken part.

### Option C — keep the wire format; add a deterministic **finalize step** + structured message fields (SELECTED)
The JSON/fence wire format stays (models already comply; prompt tests exist). What changes is *when* and *where* it is interpreted:
- One pure function `finalizeAssistantText(raw)` runs at every terminal transition (finish, stop, error) and normalizes the message: valid question → structured `message.question` + surrounding prose kept as `content`; malformed question JSON → salvage the question string (or strip the junk) so content is always renderable; plain text → untouched.
- Renderer derives the card from the structured field (with a legacy fallback parse for old persisted messages, using the same pure function — so old broken conversations self-heal on display).
- Typing indicator is derived from `isGenerating && isLast`, never from content shape. A finished message can never show an indicator.
- Selection is persisted (`message.questionAnswer`).
- Model history is rewritten: a question turn is sent as natural language ("<question> (options: A / B / C)"), never as JSON.
- Streaming: `segmentMessage` gains a streaming mode; a trailing unclosed fence/`<copy>` becomes a *pending* block that renders as the card immediately and fills live (copy button appears when the block closes). No text→card flip.

Why best for Aether: smallest diff that makes broken states impossible at the state-machine level; zero model retraining risk; backward compatible with persisted history (old raw-JSON messages still render, now correctly); streaming stays token-live.

Accepted tradeoffs:
- Question pills stay label-valued (no semantic value field). With history rewriting, the label *is* the semantics; a value field adds schema surface for small models to get wrong.
- Question JSON is still held behind the typing indicator while streaming (questions are one short line; the alternative — streaming raw JSON — is worse).
- Nested ``` inside a fence, or `</copy>` inside a copy body, still terminate the block early. Acceptable for on-device Gemma output; not worth a stateful parser.

## 3. Behavior policy

### Clarifying questions
- Ask **only** when a missing detail materially changes the result; otherwise answer with a stated assumption.
- Ask **first**, as the entire reply — never after an answer.
- One question per task; **never re-ask** an answered question.
- Open-ended clarifications: plain text, no JSON (prompt explicitly allows this).
- 2–4 short, genuinely distinct options.
- Deterministic guard: a finalized question identical (normalized) to an earlier *answered* question in the same conversation is demoted to plain text — a retry/loop can never stack duplicate interactive cards.

### Copy blocks
- Only for take-away artifacts (email, message, caption, code, command, config, template). Prompt says explicitly: never wrap explanations or ordinary prose.
- Copy payload = raw segment content, exactly as parsed (code keeps internal whitespace/indentation; one trailing newline trimmed; `<copy>` bodies trimmed at the edges only).
- Multiple blocks per message stay independent.
- Pending (unclosed) blocks show the card body but no copy button — can't copy a half-artifact.

### E2B vs E4B
Same protocol, same parser. Differences handled by *defensive* means, not divergent formats: JSON tolerance (fences, trailing commas), salvage on malformed output, history rewriting (biggest E2B win — it stops JSON-format reinforcement), and the duplicate-question demotion. UI behavior is model-independent by construction; a model that can't emit the format degrades to plain conversation.

## 4. State & persistence
- `Message` gains `question?: {question, options}` and `questionAnswer?: string` (both optional — backward compatible with every stored conversation).
- `finishAssistant` and `stopGeneration` both run finalize before saving → no un-normalized assistant message is ever persisted again.
- `recordQuestionAnswer(messageId, option)` persists the tap before `send()` fires.
- Legacy messages (raw JSON in content, no structured field) are normalized at render by the same pure function — old conversations self-heal, no migration needed.

## 5. Visual decisions (restrained)
- QuestionCard: token-clean spacing, options become `PressableScale` (press feedback per design rules), persisted picked highlight, answered card keeps the chosen pill visible. No new chrome, no animation beyond press feedback.
- CopyBlock: copy button becomes `PressableScale`; `pending` state (no button) during stream; everything else stays.
- Prose + card can now coexist in one assistant turn (prose above the card), matching "a natural pause in conversation".

## 6. Failure / rollback behavior
- Malformed question JSON at terminal: salvage `"question": "..."` → plain question text (typed answer still works); no salvage → strip the JSON region, keep remaining prose; nothing left → muted "(reply interrupted)" line. Never a crash, never a stuck indicator, never raw JSON on screen.
- Error path (`onError`) appends the error line, then finalize normalizes the whole content.
- Stop mid-block: pending copy block finalizes as a normal block with whatever content arrived, plus the existing "(stopped)" marker.

## 7. Test strategy
- Unit (jest): finalize (valid/prose-wrapped/malformed/salvage/empty), streaming segmentation (pending fence, pending copy, closed blocks), history rewriting, duplicate-question demotion, parser tolerance, prompt policy assertions.
- Component (@testing-library/react-native): MessageBubble never renders an indicator on a finished message (regression for bug #1); prose+question renders both; QuestionCard persisted-pick rendering + double-tap guard; CopyBlock pending hides button.
- Full suite + `tsc --noEmit` must stay green.

## 8. Acceptance criteria
Maps to the brief's 22 cases; the ones provable off-device are covered by the suites above. On-device verification steps for the rest are listed in `conversation-interaction-engine-verification.md`.
