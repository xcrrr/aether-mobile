# Release readiness pass (2026-07-28)

Adam asked what stood between the current tree and an MVP release, then asked for all of it
to be done. This note covers the work that is finishable without a device or a legal decision,
and states plainly what is left and who it belongs to.

## Release signing is wired, but the key does not exist yet

`android/app/build.gradle` hardcoded `signingConfig signingConfigs.debug` for the release build
type, under a comment telling the reader to generate their own keystore. A debug-signed APK
cannot be distributed: the signing key is public, anyone can produce an update that Android will
accept as the same app, and Play rejects it outright.

Release builds now read `android/keystore.properties` — gitignored, alongside `*.jks` and
`*.keystore`, with `android/app/debug.keystore` explicitly re-included because debug builds still
need it. `android/keystore.properties.example` documents the shape and carries the `keytool`
command. When the file is absent the build still succeeds and is still debug-signed, but Gradle
prints a warning saying the APK must not be distributed, and `npm run preflight:public` fails.

The keystore itself is deliberately not created here. It is a credential, it belongs to Adam, and
its backup story matters more than its creation: losing it means no future build can ever update
an installed app, and on Play it means the listing can never be updated again.

**The Gradle edit is unverified.** Neither `java` nor `groovy` is on this laptop, so the Groovy
syntax has not been parsed by anything. It is conventional signing-config code, but the first
Gradle invocation on a build machine is what proves it.

## Three permissions removed

The merged manifest requested `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and
`SYSTEM_ALERT_WINDOW`. None came from `app.json`, which declares only four permissions — all
three arrive through library manifest merge, so deleting the lines is not enough and
`tools:node="remove"` is the only durable removal. That now lives in
`plugins/withAetherAndroid.js`, running last so the existing dedup pass cannot strip the markers,
and the checked-in `AndroidManifest.xml` was updated to match.

Verified before removing rather than assumed: `minSdkVersion` is 29, so `WRITE_EXTERNAL_STORAGE`
is inert under scoped storage; `ModelManager` downloads to `documentDirectory`, which is
app-private; attachments arrive as SAF content URIs from the Expo pickers; and nothing in
`src/` or the Kotlin sources requests an overlay. The one `getExternalFilesDir` call in
`LiteRtModule.kt` is the app-scoped external directory, which has needed no permission since
API 19, and it is only reached for `/data/local/tmp` paths.

This matters beyond tidiness. `SYSTEM_ALERT_WINDOW` is React Native's dev-overlay permission, it
draws Play review attention, and "can draw over other apps" in the permission list of an app whose
entire pitch is privacy is a bad first impression that buys nothing.

Also unverified without a build: the *merged* manifest has not been inspected, only the source.

## Preflight now means something

`npm run preflight:beta` reported "No preflight blockers found" for a tree that was debug-signed
and carried four unreviewed draft legal documents. A green check that green-lights an
undistributable build is worse than no check.

There is now a `BLOCKED` status for work that is legitimately outstanding during beta development
but must be finished before anyone outside this machine gets the app. A plain run lists these and
exits 0; `npm run preflight:public` exits 1 on them. Six checks were added: version consistency
between `app.json` and `build.gradle` (two hardcoded strings that can silently drift), release
signing, the permission surface, legal draft status, and the MVP scope flag.

Current state on this laptop: 11 PASS, 2 BLOCKED (signing, legal drafts), 1 SKIPPED (no Java).

## Patches: 9.4 MB to 3.4 KB

`patches/` held 4.9 MB and 4.5 MB files, 55,602 and 51,231 lines. Of the diff blocks inside,
2,030 of 2,031 and 1,348 of 1,349 were captured Gradle output under `node_modules/*/android/build/`
— someone ran `patch-package` after a build. The real change in each is a single file.

Both were trimmed to only the blocks whose target path is not build output, then **verified by
reverse-applying each trimmed patch against `node_modules` with `git apply --check -R`**, which
passes only if the patch exactly describes the state on disk. Both passed, so the real fix —
resolving Voice and the background downloader through `TurboModuleRegistry` under bridgeless — is
intact and byte-identical.

`app/CLAUDE.md` rule 6 now warns against regenerating patches after a Gradle build, since that is
what caused this and it will recur otherwise.

## `three-forcegraph` was undeclared

`assets/graph/build.js` reads `node_modules/three-forcegraph/dist/three-forcegraph.min.js`
directly, but the package appeared nowhere in `package.json` — it resolved only as a transitive
dependency of `3d-force-graph`, and the graph build worked purely because of npm's flat hoisting.
A stricter installer, a hoisting change, or a `3d-force-graph` release that drops the dependency
would break the Core globe build with an error pointing at a file rather than at a missing
dependency. Now declared at `^1.43.4`, the resolved version.

## The website advertised a feature that does not ship

Not in the original plan; found while checking the site for the same false-advertising problem the
README had. `components/sections/Capabilities.tsx` listed five capabilities — Chat, See, Files,
Research, **Task** — with a live animated demo for each. Task is hidden from the product. Worse,
**Core was absent entirely**: the feature Adam rates equal to Research, and one of the two he
considers differentiating, had no presence on the public site at all.

`ResearchDemo` was also depicting the old sources rendering — horizontal rule, bold `**Sources**`,
plain list — which no longer exists in the app.

`app/demos-preview/page.tsx` shipped to production as a static route with no `noindex`, no robots
rule and no environment gate, hidden only by being absent from navigation. Now gated three ways:
route metadata sets `noindex, nofollow`; a new `app/robots.ts` disallows it; and a production
build without `NEXT_PUBLIC_ENABLE_DEMO_PREVIEW=1` calls `notFound()`. The `TaskDemo` component was
deliberately left in place — Codex uses that page for inspection.

## Documentation corrected against the code

`app/CLAUDE.md` had drifted. Its build command exported a `JAVA_HOME` under `/home/xcrr1`, a user
that does not exist on this laptop, so it was rewritten generically. Its test baseline said 43
suites / 538 tests; the real figure is 47 / 606. It listed "reinit self-heal after hard crash
exists (`reinit()`)" under known issues — `reinit` appears **zero** times across `src/`, `app/`
and the Kotlin sources, so the claim was removed rather than reworded.

`docs/aether-device-beta-checklist.md` still tested Task and Library, both unreachable, so anyone
running it would have blocked on a feature that no longer exists. It now verifies the scope cut
itself, and gained sections for Core, Research, the two S25 bug fixes, and a sampling comparison.

`docs/aether-legal-review-required.md` gained a Resolved section recording the distribution and
signing decisions rather than deleting the open questions.

## What is left, and whose it is

**Adam's, and nobody else can do them:**

1. Create the release keystore and back it up somewhere that survives this laptop dying.
2. Publisher identity, support contact, privacy contact, jurisdiction. Everything else in the
   legal set is blocked behind these four strings.
3. Finalise the four in-app documents, all still `2026.07.02-draft.1`.
4. Decide whether the Closed Beta gate is still right now that the plan is a paid Play purchase
   plus a free GitHub build. It currently applies identically to both.

**Needs a machine with a Java toolchain:**

5. Build an APK and run the checklist. Nothing since the 2026-07-07 APK is device-verified — not
   the Core label fix, not the Research UI, not the sampling change, not the two S25 bug fixes,
   not the permission removal, not the Gradle signing edit.
6. Screenshots for the README, which currently carries placeholder comments rather than fabricated
   image links.
7. `expo-print` could come out for a smaller APK now that artifact export is unreachable, but
   removing an Expo native module without a prebuild and Gradle verify is exactly the change that
   breaks a build silently. Deliberately not done here.

**Still open from earlier sessions:** Core auto-extraction preemption, and the absence of any
fixture set measuring whether extraction proposes the right facts.

## State

`npm test` 47 suites / 606 tests green. `npm run typecheck` clean. `npm run preflight:beta` shows
2 BLOCKED, 1 SKIPPED, everything else passing. Website lint, typecheck and build green.

No Android build has been attempted, so every native-facing change in this note — signing,
permissions, the manifest — is reasoned from source and unproven.
