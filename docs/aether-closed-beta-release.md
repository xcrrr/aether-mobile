# Aether Closed Beta Release Foundation

Last updated: 2026-07-02  
Status: implementation-ready for legal review and closed-beta preparation. This is not a legal compliance certification.

## Implemented Foundation

- Versioned legal document registry in `app/src/legal/documents.ts`.
- Required Closed Beta Terms acceptance stored locally in `@aether/legal_acceptance`.
- Route-level gate blocks `/(main)` until current required terms are accepted and profile onboarding is complete.
- Re-acceptance is required automatically when the Closed Beta Terms version changes.
- Privacy Notice, Research Disclosure, AI Safety Notice, accepted versions, app version/build, placeholder contact, and local reset are available in Settings.
- Research Disclosure appears before first online Research use and before a Task can use the same web research tool.
- Declining the Research Disclosure never goes online and never discards the message: a Research query falls back to ordinary local chat, a Task runs local-only with web research blocked in code.
- Permission explanations are shown before microphone, camera, photo-library, file-picker, and notification permission flows.
- Local reset removes Aether-owned AsyncStorage keys plus downloaded models and stored chat images.

## Legal Documents

| Document | ID | Version | Required for app entry | Status |
|---|---|---:|---|---|
| Closed Beta Terms | `beta-terms` | `2026.07.02-draft.1` | Yes | Draft — publisher/legal review required |
| Privacy Notice | `privacy-notice` | `2026.07.02-draft.1` | No | Draft — publisher/legal review required |
| Online Research Disclosure | `research-disclosure` | `2026.07.02-draft.1` | Feature gate | Draft — publisher/legal review required |
| AI Safety Notice | `ai-safety-notice` | `2026.07.02-draft.1` | No | Draft — publisher/legal review required |

## Release Workflow

Run from `app/`:

```bash
npm run preflight:beta
```

The command reports `PASS`, `FAIL`, or `SKIPPED`. It runs Jest and strict TypeScript when local dependencies are available, checks release identity/version files, checks required legal docs, checks required release docs, verifies the Gradle wrapper, and reports Java availability. It does not build or validate an APK.

Known APK build path from project notes:

```bash
cd app/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

On Windows, the existing playbook recommends building from a short path such as `C:\a2` to avoid CMake/Ninja path-length issues.

## Release Blockers

P0 before public release:

- Final Terms and Privacy Notice must be reviewed and approved by the publisher/legal representative.
- Publisher/developer identity, privacy contact, support contact, jurisdiction, age/minor policy, and public Privacy Policy URL are not finalized.
- Google Play Data Safety or equivalent distribution disclosure is not completed.
- Android speech recognition provider behavior must be verified on target beta devices.

P1 before closed beta expansion:

- Real-device verification of the full onboarding gate, Research disclosure, voice, file/image permissions, model download, model load, chat, Core, and reset flows.
- Decide whether the native manifest should keep `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW`; they appear in the generated manifest and need review.
- Confirm release signing. Current Android release config signs with the debug keystore.

P2 follow-up:

- Add a real support/privacy contact and public document URLs when approved.
- Decide retention language for conversations, Core memory, model files, and reset behavior.
- Update website release link/version if the beta APK version changes.

## Beta APK/AAB Steps After Legal Text Is Final

1. Replace draft legal copy or set approved public URLs in `app/src/legal/documents.ts`; bump versions for any changed required document.
2. Run `cd app && npm run preflight:beta`.
3. Run `cd app && npm run typecheck && npm test -- --runInBand`.
4. Build a release artifact from the short-path workspace if needed: `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`.
5. Install on a real Android test device and execute `docs/aether-device-beta-checklist.md`.
6. Record APK/AAB hash, versionName/versionCode, device results, and unresolved blockers in `codex-notes/` or release notes.
