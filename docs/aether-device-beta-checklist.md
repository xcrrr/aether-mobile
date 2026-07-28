# Aether Device Beta Checklist

Use a clean Android test device or clear app data before starting. Record device model, Android version, APK filename/hash, app version, and build number.

## Install And Gate

- Install the beta APK.
- Launch Aether with cleared app data.
- Confirm the Closed Beta notice appears before any main app screen.
- Open Closed Beta Terms from the gate and verify version/effective date are visible.
- Open Privacy Notice from the gate and verify it is readable.
- Tap Not now and confirm the app does not enter the main app.
- Relaunch, accept the current Closed Beta Terms, and confirm profile onboarding continues.
- Complete profile onboarding and confirm the main app opens.
- Clear app data and confirm the Closed Beta gate appears again.

## Legal And Privacy Center

- Open Settings.
- Confirm Legal & Privacy lists Closed Beta Terms, Privacy Notice, Online Research Disclosure, and AI Safety Notice.
- Confirm accepted document version/status is shown for Closed Beta Terms.
- Confirm app version/build and package id are shown.
- Confirm support/privacy contact is clearly marked as publisher setup required.
- Open each document and confirm draft/review status is visible.
- Run Reset local Aether data, confirm the warning text is clear, then cancel.
- Run Reset local Aether data on a disposable install and confirm onboarding/gate returns.

## Research Disclosure

- Complete app onboarding and start a normal local chat message.
- Confirm normal local chat does not show the Research disclosure.
- Toggle Research and submit a query.
- Confirm Online Research Disclosure appears before web activity starts.
- Decline it and confirm no Research answer is generated.
- Submit Research again, accept disclosure, and confirm web search/source reading starts.

## Permissions

- Tap Voice for the first time and confirm an Aether explanation appears before Android microphone permission.
- Deny microphone permission and confirm the app stays usable.
- Choose Camera attachment and confirm an explanation appears before camera permission.
- Choose Library attachment and confirm an explanation appears before photo permission.
- Choose Files and confirm an explanation appears before the picker opens.
- Start a model download on Android 13+ and confirm notification explanation appears before notification permission.

## Scope Cut Verification

- Open the composer's mode menu and confirm no Task row appears; Research is the only mode offered.
- Confirm the sidebar has no Library entry.
- Trigger a deep link to /library and confirm it redirects away rather than showing a dead screen.
- Complete onboarding through phase 3 and confirm the heading reads "One mode, used on purpose" describing Research alone, with no Task capability card.

## Core App Flows

- Download the recommended model.
- Confirm download progress appears and can be cancelled.
- Confirm deleting the model removes it from installed state.
- Load the model and send a local chat message.
- Attach an image and confirm vision state is communicated honestly.
- Attach a PDF/text/docx file and confirm extracted text is handled or a friendly error appears.
- Confirm conversations persist after app restart.
- Delete a conversation and verify it disappears from Recents.

## Core

- Use Core/Second Brain and confirm saved notes can be viewed/cleared.
- Save roughly twenty memories, open Core, and confirm roughly that many named labels are readable at the default whole-globe framing (the earlier bug showed only six).
- Save two memories that share the same key in different categories and confirm both appear as separate nodes.
- Save a note about "climbing" and confirm a later message saying "climb" recalls it.

## Research

- Submit a research query and confirm the answer is grounded in three sources, not one or two.
- Watch the live card while the query runs and confirm it shows each source's domain, title, and whether it was read or failed.
- Confirm the finished answer carries inline [n] markers that match the numbered source cards beneath it.
- Tap a source card and confirm it opens that source.
- Switch on airplane mode, submit a research query, and confirm an offline message appears instead of a prompt to rephrase.
- Submit a deliberately obscure nonsense query and confirm a no-results message appears.
- Repeat every check above in both light and dark theme; this is the single most important visual check in this document.

## Sampling Comparison

- Ask a handful of factual and reasoning questions against the shipped sampling defaults (temperature 0.7, topK 40, topP 0.9) and record the answers.
- Edit the three constants at the top of `LiteRtService.ts` to the prior defaults (temperature 1.0, topK 64, topP 0.95), rebuild, and ask the identical questions.
- Compare the two answer sets and flag any reply that drifts from the question or invents unsupported detail.

## Navigation And Scroll

- Open Settings from the drawer, use the system back gesture, and confirm it returns to the last chat with no gray or blank frame.
- Open Core from the drawer, use the system back gesture, and confirm the same clean return to the last chat.
- Scroll up in a long conversation, send a new message, and confirm the view jumps to the newest turn.
- Scroll up during active streaming and confirm the view stays where scrolled rather than snapping back to the bottom.

## Release Configuration

- Confirm Typography Preview is not reachable in a release build.
- Confirm no debug-only route or Graph Lab UI is visible in normal navigation.
- Confirm no startup permission prompt appears before user-initiated actions.
- Confirm the APK versionName/versionCode match release notes.
- Confirm release signing choice is intentional and documented.
