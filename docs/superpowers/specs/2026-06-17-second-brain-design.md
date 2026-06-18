# Second Brain (Memory Layer) — Design

**Date:** 2026-06-17
**Feature:** Beta 2 — Feature 4: Second Brain

## Goal

A silent memory layer that observes every conversation, extracts persistent
structured facts about the user, stores them on-device, and injects them into
every system prompt so the model always responds with full personal context.
Fully private — nothing leaves the device.

## Module: `src/secondbrain/`

### `types.ts`
- `MemoryCategory` — `identity | personality | preferences | goals | knowledge | relationships | patterns | emotional | context`
- `MemoryEntry` — `id, category, key, value, confidence (0–1), sourceConversationId, createdAt, updatedAt, timesReinforced`
- `UserMemory` — `userId, entries[], lastExtractionAt, totalConversationsAnalyzed`

### `MemoryStore.ts`
Zustand store using the `persist` middleware → AsyncStorage key
`aether_second_brain`. State: `userMemory: UserMemory`, `enabled: boolean`
(default `true`). Actions:
- `addOrUpdateEntry(entry: Omit<MemoryEntry,'id'|'createdAt'|'updatedAt'>)` —
  upsert keyed on `category + key`; on match update `value`/`updatedAt` and
  increment `timesReinforced`; else insert new (fresh `id`, timestamps,
  `timesReinforced: 0`).
- `getEntriesByCategory(category)`, `getAllEntries()`, `deleteEntry(id)`, `clearAll()`
- `setEnabled(enabled)`, plus `recordExtraction()` to bump `lastExtractionAt` /
  `totalConversationsAnalyzed`.

`userId` is a device UUID generated lazily on first store init and persisted.

### `MemoryExtractor.ts`
`extractFromConversation(messages: Message[], conversationId: string): Promise<void>`
1. Skip when disabled or `< 2` user messages.
2. Build the extraction prompt (template below) from the conversation text.
3. Run a **silent** sequential inference via `Llama.extract()` — temperature
   `0.1`, `n_predict: 512`, not shown in chat UI. Runs after the assistant
   reply finishes, so the single shared `llama.rn` context is free.
4. Parse the JSON array safely (try/catch); skip malformed/invalid entries
   (bad category, empty key/value, out-of-range confidence).
5. Upsert each valid entry via `MemoryStore.addOrUpdateEntry`.
6. Record extraction stats. Fully async; never blocks the UI.

### `MemoryInjector.ts`
`buildMemorySystemPrompt(entries: MemoryEntry[]): string` — sort by
`timesReinforced DESC, confidence DESC`, cap 40, group by category, render a
"What you know about this person" section + behavioural guidance. Returns `''`
when there are no entries.

## Integration (adapted to actual aetherbeta wiring)
- `buildSystemPrompt()` lives in `src/llm/prompt.ts` (not LlamaService). It will
  prepend `buildMemorySystemPrompt(getAllEntries())` when the store is enabled.
  Done via `useInference.send()` which already calls `buildSystemPrompt`.
- Extraction is triggered from `useInference.send()` `onDone` (after
  `finishAssistant`), fire-and-forget.
- `LlamaService.extract(prompt)` — new function: accumulates tokens from a
  `context.completion` call and resolves the full string. Returns `null` if no
  model loaded or generation already in flight.

## Settings screen
`src/components/settings/SecondBrainScreen.tsx` + route `app/(main)/second-brain.tsx`:
- Header "Second Brain" + subtitle.
- "Enable Second Brain" toggle (persisted in the store).
- Extraction status row (last extraction time, total conversations analyzed).
- Entries grouped by category — each row: key + value + confidence badge + trash.
- "Clear all memory" button with confirm dialog.
- Reachable via a row added to the existing Settings screen.

## Extraction prompt template
```
You are a memory extraction system. Analyze this conversation and extract
factual, persistent information about the user. Return ONLY a valid JSON array.
No explanation, no markdown, just the raw JSON array.
Each object must have exactly these fields:
"category": one of: identity, personality, preferences, goals, knowledge, relationships, patterns, emotional, context
"key": a short snake_case identifier
"value": the extracted fact as a concise string
"confidence": a float 0.0-1.0
Only extract facts that are clearly stated or strongly implied. Do not invent.
If nothing new can be extracted, return [].
Conversation:

{CONVERSATION_TEXT}
```

## Testing
Jest (scoped to `src/`): `MemoryStore` upsert/reinforce, `MemoryInjector`
sort/cap/format, `MemoryExtractor` JSON-parse safety + skip rules (mocked
inference). The screen/route are not unit-tested (UI).
