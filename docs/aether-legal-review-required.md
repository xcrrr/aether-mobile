# Aether Legal Review Required

This document lists unresolved legal/product questions before Aether can be released publicly. Codex is not legal counsel. The in-app documents are draft containers and require publisher/legal representative review.

## Required Decisions

- Formal publisher/developer identity for the app, website, release artifacts, and support materials.
- Controller/business identity and privacy contact.
- Support contact shown in-app and in store/release channels.
- Final jurisdiction, applicable-law approach, and dispute/consumer-rights language.
- Final Closed Beta Terms wording.
- Final Privacy Notice wording.
- Whether separate public Terms and Privacy Policy URLs will be hosted on the website.
- Final retention/deletion commitments for conversations, Core memory, agent task records, uploaded/attached local files, model files, logs, and reset behavior.
- Age policy, including whether parental/guardian consent is required for any users, and confirmation that the store account holder meets the platform's eligibility requirements.
- Medical/legal/financial/safety disclaimer wording appropriate to the product and target jurisdictions.
- Google Play Data Safety declaration or equivalent disclosure for any distribution channel.
- Whether the in-app Closed Beta gate is still the right shape now that the plan is a paid Play purchase alongside a free GitHub build. The gate currently applies identically to both channels.
- Required disclosures for Hugging Face model downloads and Google AI Edge LiteRT runtime.
- Required disclosures for DuckDuckGo HTML search and fetched third-party websites in Research.
- Required disclosures for Android speech recognition providers, including Google/Samsung/device recognizers.
- Whether website beta signup will connect to an email provider; if yes, provider, retention, opt-out, and privacy wording.
- Whether crash reporting, analytics, support ticketing, or remote config will be added before beta.
- Final model/license notices for `.litertlm` model files and LiteRT dependencies.

## Resolved (2026-07-28)

Kept here rather than deleted so the audit trail survives.

- **Distribution plan.** A free, unrestricted build on GitHub Releases, alongside a paid one-time purchase on Google Play with Google as merchant of record. Pricing is recorded outside this repository. Using the store as merchant of record is what resolves the VAT and consumer-law exposure.
- **Whether beta access is conditioned.** Follows from the above — the GitHub build is unconditioned, the store build is paid.
- **Android release signing.** `android/app/build.gradle` now reads credentials from `android/keystore.properties`, which is gitignored along with `*.jks`. See `android/keystore.properties.example`. The keystore itself has not been created yet; until it exists, release builds are debug-signed and Gradle prints a warning. `npm run preflight:public` fails while that is the case.
- **Unused manifest permissions.** `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW` are removed via `tools:node="remove"` in `plugins/withAetherAndroid.js`. All three arrived through library manifest merge, never from Aether's own config. minSdkVersion is 29, so the storage pair was already inert under scoped storage; models download to app-private `documentDirectory` and attachments arrive as SAF content URIs. Nothing in the app draws overlays. Not yet confirmed against a real merged manifest — that needs a Gradle build.

## Current Draft In-App Documents

- Closed Beta Terms: `beta-terms`, version `2026.07.02-draft.1`.
- Privacy Notice: `privacy-notice`, version `2026.07.02-draft.1`.
- Online Research Disclosure: `research-disclosure`, version `2026.07.02-draft.1`.
- AI Safety Notice: `ai-safety-notice`, version `2026.07.02-draft.1`.

Every draft document must visibly state: "Draft — requires review by the publisher / legal representative before release."

## Evidence To Review

- `docs/aether-data-flow-map.md`
- `docs/aether-closed-beta-release.md`
- `docs/aether-device-beta-checklist.md`
- `app/src/legal/documents.ts`
- `app/src/legal/acceptance.ts`
- `app/app/onboarding/index.tsx`
- `app/app/(main)/chat/[id].tsx`
- `app/src/components/legal/LegalCenter.tsx`
