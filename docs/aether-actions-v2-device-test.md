# Aether Actions V2 — Device Test Script

**Superseded (2026-07-02):** use `aether-local-agent-device-verification.md` — the UI, naming (Act→Task), modes, and routing changed in the V3 product reset.

**Date:** 2026-07-02 · Run on a real Android device with a fresh APK build.
Each test: set the mode via the Act pill's autonomy selector, send the goal,
observe. Record pass/fail per the exact criteria.

## 1. Simple plan, no tools (E4B, Balanced)

Goal: `Make me a simple 3-step morning routine.`

- **Pass:** completes in ≤ ~30s of model time; either answers directly
  (finish on step 1) or creates ONE artifact; final reply is normal prose;
  receipt shows 1–2 steps; no raw JSON anywhere in chat.
- **Fail:** any duplicate artifact, any visible `__aether_action`, no final reply.

## 2. Current research task (E4B, Balanced)

Goal: `Research the current state of small on-device language models and give me the key takeaways.`

- **Pass:** 1–2 web_research steps run; final reply cites what was found;
  receipt lists real sources; task ends without intervention.
- **Fail:** research repeats the same query, or the task ends with "(no reply)".

## 3. Research → artifact (E4B, Balanced)

Goal: `Research on-device LLM trends and create a decision brief artifact.`

- **Pass:** research runs, ONE artifact is created (View shows real content
  grounded in the research), task completes, final reply summarizes the brief
  in 1–3 sentences WITHOUT pasting the whole brief, artifact shows "Keep".
- **Fail:** second equivalent artifact appears; final reply duplicates the
  full artifact; loop after artifact creation.

## 4. Strict approval + decline (E4B, Strict)

Goal: same as test 2, mode Strict.

- **Pass:** a visible approval card appears BEFORE any research runs, naming
  the tool and query. **Approve** → it runs. Re-run the task and **Skip** →
  the step is recorded "declined", nothing executes for it, and the task still
  ends with an honest reply. Receipt shows the declined step.
- **Fail:** research runs without a card; declining is followed by the same
  action executing anyway; task hangs after decline.

## 5. Auto artifact save (E4B, Auto)

Goal: `Create a checklist for publishing an Android app.`

- **Pass:** artifact is created and shows "Kept" (saved) without a tap;
  it appears in saved artifacts; receipt marks it saved.
- **Fail:** artifact stays a draft, or saving happens in Balanced/Strict
  without a tap.

## 6. Stop during work (E4B, any mode)

Goal: test 2's goal; hit Stop while research is visibly running.

- **Pass:** task ends promptly as "Stopped"; receipt status is Stopped with
  the note that later steps did not run; no final answer appears afterwards;
  next chat message works normally.
- **Fail:** task keeps stepping after Stop, or later shows Completed.

## 7. E2B graceful degradation (E2B, Balanced)

Goal: `Research today's AI news and create a summary artifact.`

- **Pass:** even if E2B fumbles action JSON, the task ends by itself within
  its budget with a final reply grounded in whatever completed (possibly the
  deterministic "Here's what I completed" answer). No infinite loop, no crash.
- **Fail:** spinner runs past the wall clock; task ends with raw JSON or nothing.

## 8. E4B multi-step with clarification (E4B, Balanced)

Goal: `Plan a study schedule for me — ask me anything you need first.`

- **Pass:** at most ONE question card appears; answering resumes the task;
  the final artifact/reply reflects the chosen answer; no protocol text leaks.
- **Fail:** repeated questions, ignored answer, or stall after answering.

## Recording

For each test note: mode, model, steps in receipt, duration, and any
screenshot into `design-artifacts/`. File failures with the exact receipt
contents — the ledger is the ground truth for debugging.
