# Closed Beta Release Foundation Handoff

Date: 2026-07-02  
Agent: Codex

## What Changed

- Added versioned legal document registry with draft review notices:
  - `app/src/legal/documents.ts`
  - `app/src/legal/acceptance.ts`
  - `app/src/legal/gate.ts`
  - `app/src/legal/researchDisclosure.ts`
- Replaced the old route trust in `onboarded` with a release gate:
  - root route sends users to onboarding unless current required terms are accepted and profile onboarding is complete.
  - main drawer layout redirects direct/deep access back to onboarding until the gate is satisfied.
- Added onboarding Closed Beta gate before the existing visual/profile onboarding.
  - user can open Closed Beta Terms and Privacy Notice before entering.
  - refusing does not enter the app.
  - Beta Terms version changes require re-acceptance.
- Added Settings Legal & Privacy Center.
  - shows all legal docs, versions/status, app version/build, package id, publisher-contact placeholder, and local reset.
- Added Research Disclosure gating before explicit Research and before Act mode can use the shared web research tool.
- Added contextual permission explanations before microphone, camera, photo library, file picker, and model-download notification permission flows.
- Added local reset implementation for AsyncStorage keys, model files, chat media, and live in-memory stores.
- Added release preflight command: `cd app && npm run preflight:beta`.
- Added release docs:
  - `docs/aether-data-flow-map.md`
  - `docs/aether-closed-beta-release.md`
  - `docs/aether-device-beta-checklist.md`
  - `docs/aether-legal-review-required.md`

## Data-Flow Findings

Proven mobile network surfaces:

- Model downloads from Hugging Face `litert-community/.../resolve/main/...`.
- Research via DuckDuckGo HTML search plus public page fetches.
- Agent Actions can call the same web research executor.

No mobile account/auth, analytics SDK, crash SDK, or backend API was identified in source.

Unknown/manual verification:

- Android speech recognition provider behavior on target devices.
- Final publisher/legal identity, contact, jurisdiction, age/minor policy, public privacy URL, and Google Play Data Safety answers.
- Generated manifest includes permissions broader than `app.json` (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`); review before release.
- Android release config currently signs release with debug signing config.

## Tests / Verification

Passed:

- `cd app && npm.cmd test -- --runInBand`
  - 36 suites, 434 tests.
  - Existing React Native Animated `act(...)` warnings remain in `MessageBubble` tests.
- `cd app && npm.cmd run typecheck -- --pretty false`
- `cd app && npm.cmd run preflight:beta`
  - Java unavailable on PATH was correctly reported as `SKIPPED`; APK build was not attempted.

## Likely Merge Conflict Areas

Other agents working on onboarding, settings, Agent V2, streaming, typography, or Second Brain may touch:

- `app/app/onboarding/index.tsx`
- `app/app/(main)/chat/[id].tsx`
- `app/app/(main)/settings.tsx`
- `app/app/(main)/_layout.tsx`
- `app/src/hooks/useInference.ts`
- `app/src/state/useChatStore.ts`
- `app/src/state/useModelStore.ts`
- `app/src/state/useAgentStore.ts`
- `app/src/secondbrain/MemoryStore.ts`
- `app/package.json`

Preserve the new legal gate behavior if resolving conflicts: main app access must require current `beta-terms` acceptance plus profile onboarding.

