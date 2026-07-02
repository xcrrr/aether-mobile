# Aether Local Agent — Device Verification (15–20 min)

**Date:** 2026-07-02 · Fresh APK on a real Android device. Supersedes
`aether-actions-v2-device-test.md`.

Setup: install E4B and E2B, open a new chat, engage the **Task** pill (composer “+”
bar). Default autonomy unless a test says **Ask first**. Record pass/fail per test;
screenshot anything visual into `design-artifacts/`.

## 1. Simple request stays chat (E4B, Task pill ON)

Send: `hi` — then: `what is a binary tree?`

- **Pass:** both answer as ordinary streaming chat. No task card, no receipt,
  no extra latency vs normal chat.
- **Fail:** any task UI or multi-second planning pause.

## 2. Current-information request uses Research (E4B)

Send: `Research the current state of small on-device language models and give me the key takeaways.`

- **Pass:** ≤2 research milestones appear ("Looked at the web"); final reply cites
  what was found; receipt lists real sources; ends without intervention.
- **Fail:** repeated identical queries, "(no reply)", or raw JSON anywhere.

## 3. Research + artifact (E4B)

Send: `Research on-device LLM trends and create a decision brief.`

- **Pass:** research runs, ONE artifact appears with real grounded content (View),
  final reply summarizes it in 1–3 sentences without pasting it, artifact shows
  **Keep** (not auto-saved), task ends cleanly.
- **Fail:** second artifact, full-brief-pasted reply, loop after creation.

## 4. Refinement follow-up (E4B, same chat as test 3)

Send: `make it shorter` — then: `add a risks section`

- **Pass:** each completes fast (ONE model call — noticeably quicker than a task);
  the SAME document updates (no second artifact block); reply says it was updated.
- **Fail:** new duplicate artifact, full re-research, or "no artifact" error.

## 5. One clarification (E4B)

Send: `Plan a study schedule for me — ask me anything you need first.`

- **Pass:** at most ONE question card; answering resumes the same task; result
  reflects the answer.
- **Fail:** repeated questions, ignored answer, stall.

## 6. Disclosure decline is honest (fresh install or cleared acceptance)

With the Research disclosure not yet accepted, send a task:
`Research today's AI news and summarize.` → tap **Stay in local chat**.

- **Pass:** the message is NOT lost — a task still runs local-only (or answers
  honestly that it can't browse); receipt shows research was off; no fake sources.
- **Fail:** nothing happens after decline, or the reply invents web content.

## 7. Ask first + decline (E4B, Ask first ON)

Send test 2's goal. When the approval card appears ("Aether wants to search the
web"), first run: **Allow** → completes. Second run: **Skip**.

- **Pass:** card appears BEFORE any research; Skip → step recorded declined,
  nothing executes for it, task still ends with an honest reply.
- **Fail:** research without a card; decline followed by execution; hang.

## 8. Stop (E4B)

Send test 2's goal; tap **Stop** on the card while research is visibly running.

- **Pass:** ends promptly as Stopped; "_Stopped._" or partial-honest reply; receipt
  notes later steps did not run; next message works normally.
- **Fail:** keeps stepping, or later shows Completed.

## 9. E2B safety floor (E2B, default)

Send: `Research today's AI news and create a summary artifact.`

- **Pass:** ends by itself within budget with a grounded reply (possibly the
  deterministic "Here's what I completed" answer). No loop, no protocol leak, no crash.
- **Fail:** spinner past ~6 min; raw `__aether_action` text; empty ending.

## 10. Visual quality (both themes)

Look at: Task pill + Ask first pill, live card during test 3, approval card,
receipt expanded, artifact block.

- **Pass:** calm and chat-native; milestones read as outcomes, not tool telemetry;
  Stop is obvious; nothing looks like a terminal or a dashboard; typography matches
  the app; both themes correct.
- **Fail:** any raw identifiers, cramped rows, mode jargon, or "prototype pasted
  into chat" feel.

## Recording

Per test: model, result, receipt contents on failure (the ledger is ground truth),
duration for tests 3–4, screenshots for test 10.
