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
- Engage the Task pill before accepting disclosure on a clean install; decline it and confirm the task still runs local-only with web research blocked (see `aether-local-agent-device-verification.md` test 6).

## Permissions

- Tap Voice for the first time and confirm an Aether explanation appears before Android microphone permission.
- Deny microphone permission and confirm the app stays usable.
- Choose Camera attachment and confirm an explanation appears before camera permission.
- Choose Library attachment and confirm an explanation appears before photo permission.
- Choose Files and confirm an explanation appears before the picker opens.
- Start a model download on Android 13+ and confirm notification explanation appears before notification permission.

## Core App Flows

- Download the recommended model.
- Confirm download progress appears and can be cancelled.
- Confirm deleting the model removes it from installed state.
- Load the model and send a local chat message.
- Attach an image and confirm vision state is communicated honestly.
- Attach a PDF/text/docx file and confirm extracted text is handled or a friendly error appears.
- Confirm conversations persist after app restart.
- Delete a conversation and verify it disappears from Recents.
- Use Core/Second Brain and confirm saved notes can be viewed/cleared.
- Run a Task with "Ask first" off (default) and on, and verify approvals/questions behave as expected (full script: `aether-local-agent-device-verification.md`).

## Release Configuration

- Confirm Typography Preview is not reachable in a release build.
- Confirm no debug-only route or Graph Lab UI is visible in normal navigation.
- Confirm no startup permission prompt appears before user-initiated actions.
- Confirm the APK versionName/versionCode match release notes.
- Confirm release signing choice is intentional and documented.

