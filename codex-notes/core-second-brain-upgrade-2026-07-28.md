# Core / Second Brain reliability upgrade — 2026-07-28

## Scope and constraints

Adam asked for a full audit and upgrade of Core: better learning from ordinary
chats, better recall into ordinary chats, and a fix for the recurring appearance
that only six memories existed. Work was done in the canonical checkout
`/home/xcrr/repos/aether`, on branch `mvp-release-prep`.

The existing Core globe and product styling were preserved. This was a
reliability, retrieval, and bounded UI-hardening pass, not a redesign.

## What was actually wrong

- Automatic extraction read the mutable active chat when the queue drained. If
  the user navigated to another conversation, the originating chat was skipped
  or the wrong chat could be inspected.
- Extraction was queued only after successful reply/title completion. Errors,
  stops, and Research exchanges did not consistently reach Core.
- A private 30-second retry loop could silently discard work and could report a
  late result outside the normal notice path.
- Grounding accepted an unordered 80% bag of words across all user messages.
  That did not meet Core's promise that evidence is a verbatim user quote.
- Authority checks used the newest turn in the transcript rather than the
  message that supplied the evidence. An old, deleted fact could therefore be
  revived by an unrelated later turn.
- Re-running the same transcript counted the same message as a new
  reinforcement.
- Same-category equal values were treated as duplicate identity. Legitimately
  different facts such as `birth_city = Warsaw` and `current_city = Warsaw`
  could collapse.
- Broad key-anchor matching could merge related but different facts, such as a
  marathon date and marathon training routine.
- Clear/reset did not rotate the automatic-extraction consent generation, and
  stale purges did not leave tombstones.
- Ambient recall's E4B/E2B cap of 6/3 was also used for explicit profile
  questions such as “what does Core know about me?”, creating a second,
  independent six-memory ceiling.
- Recall had narrow profile intents, ignored useful evidence text, flattened
  communication-style guidance into factual context, and one malformed legacy
  record could fail the whole selection.
- Core search showed only the first 40 graph nodes. Several smaller navigation,
  filter, late-WebView, and deleted-source edge cases remained.

## Implemented

### Everyday chat collection

- `useInference.ts` captures the immutable originating conversation id and the
  Core consent snapshot before the send.
- The extraction queue waits for visible generation to finish, then loads the
  originating conversation from storage by id if it is no longer active.
- Work is queued before generation completion, so success, error, stop, and
  Research terminal paths remain eligible.
- Research user turns now carry the same Core consent marker. Core data is not
  added to the outbound Research query.
- One queue now owns retry state. A retryable busy result remains queued until
  the shared LiteRT session is idle; late completion is reported only through
  the normal result path.
- Cold hydration fails closed: an unresolved Core store produces no recall and
  no extraction consent for that send.

### Evidence, identity, and user authority

- Every extracted fact must quote a contiguous, normalized span from one user
  message. Assistant text, reordered word bags, and quotes assembled across
  messages are rejected.
- Each saved observation records `evidenceMessageId` and `observedAt`.
- Deletion/manual-edit authority compares against that evidence message's time,
  not an unrelated newer turn.
- Reprocessing the same evidence message is a no-op; a genuinely new message can
  reinforce the fact.
- Store identity is category plus normalized key. Equal values under distinct
  keys survive.
- Key aliasing distinguishes temporal and activity qualifiers, preserving
  related facts such as `marathon_date` and `marathon_training` while still
  handling safe model renames such as date/schedule.
- Clear and local reset rotate extraction consent. Purging stale notes now
  records tombstones and removes dangling edges.
- Longer user turns use bounded head/tail clipping instead of keeping only the
  first 600 characters.

### Recall into everyday chats

- Ordinary topical recall intentionally remains small: 6 notes for E4B and 3
  for E2B.
- Explicit profile questions have a separate envelope: up to 24 notes / 4,800
  characters for E4B and 20 notes / 3,000 characters for E2B. Regression tests
  return all 20 concise notes on both models.
- ASK-gated facets now cover job, location, language, relationships, skills,
  personality, preferences, goals, and projects. Ordinary requests about work
  or a topic do not trigger profile disclosure.
- Evidence can cautiously improve ranking, or provide a fallback only when two
  distinctive evidence tokens match the current user turn.
- Malformed legacy entries are skipped individually.
- Saved communication style and relevant factual context are rendered in
  separate prompt sections. Current user statements remain authoritative.

### Existing Core UI

- Graph search returns every node instead of slicing at 40.
- Android Back closes the memory list before leaving Core.
- Category filters that no longer exist are pruned.
- A late WebView `ready` event clears a startup timeout error.
- “Open source” is shown and routed only while the source conversation still
  exists.
- Core toolbar controls gained accessibility labels.

The earlier globe label-budget fix and duplicate-key node fix remain in the
generated `assets/graph/graph.html`; the old July 7 APK predates them.

## Verification

- Full app Jest: **49 suites / 641 tests passed**.
- Strict TypeScript: passed.
- `git diff --check`: passed.
- `npm run preflight:beta`: all development checks passed. It correctly reports
  the existing public-distribution blockers: no private release keystore and
  legal documents still in draft review.
- Android `assembleRelease`: **BUILD SUCCESSFUL** in 10m42s using the local
  JDK/SDK. Gradle's existing LiteRT Kotlin metadata messages remained non-fatal.
- Device-test APK:
  `releases/Aether-2.1.0-core-upgrade-debug-signed.apk`
- APK identity: `com.aether.app`, versionName `2.1.0`, versionCode `4`.
- APK size: 133 MB.
- SHA-256:
  `4471fc8b4295c9769a01718c4964370d23a09d452709a0efa16f48775f1972d9`
- APK Signature Scheme v2 verifies. Signer is `CN=Android Debug`; this artifact
  is for local/device testing only and must not be distributed publicly.

## Still open

- Real-device Core verification is not complete. The Galaxy S25 Ultra is visible
  to Linux in Samsung MTP mode, but ADB does not yet see a debugging interface.
  Enable USB debugging and authorize the host, then run
  `docs/aether-device-beta-checklist.md`.
- Static tests prove the gates and routing, not Gemma's subjective extraction
  quality. The highest-value next Core evaluation is a sanitized fixture set of
  real everyday conversations with expected saved facts and expected recalls.
- Create/back up the real release keystore and finalize the legal documents
  before public distribution.

No commit, push, public release, or destructive data migration was performed.
