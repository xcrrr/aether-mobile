# Build and release changes from Claude — 2026-07-28

Written for Codex. Five things changed on branch `mvp-release-prep` that will surprise you if
you hit them without warning. Everything here is source-only: no Android build has been run, so
none of it is proven against Gradle.

## 1. The release build is no longer hardcoded to debug signing

`android/app/build.gradle` used `signingConfig signingConfigs.debug` for the release build type.
It now reads `android/keystore.properties` — gitignored, alongside `*.jks` and `*.keystore`,
with `android/app/debug.keystore` explicitly re-included so debug builds still work.

If that properties file is absent, the release build **still succeeds and is still
debug-signed**, exactly as before, but Gradle prints a warning. So your existing build commands
keep working unchanged. `android/keystore.properties.example` documents the shape.

The Groovy has not been parsed by anything — there is no `java` or `groovy` on the Linux laptop.
**Your first `./gradlew assembleRelease` is what proves it.** If it fails to configure, that
block is the first place to look.

## 2. Three permissions are stripped via `tools:node="remove"`

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW` were in the merged
manifest. None came from `app.json` — all three arrive through library manifest merge, so
deleting the lines does not work and the merger puts them back.

`plugins/withAetherAndroid.js` gained `withStrippedPermissions`, which runs **last** so the
existing dedup pass cannot strip the removal markers. `android/app/src/main/AndroidManifest.xml`
was updated to match by hand, since `android/` is committed source and prebuild is not always
re-run.

Worth checking on your side, because it cannot be checked here: dump the **merged** manifest
from a real build and confirm all three are actually gone and that nothing else broke in the
merge. If a library hard-requires one of them the merge will fail loudly rather than silently,
which is the good failure mode.

## 3. `patches/` shrank from 9.4 MB to 3.4 KB — this was not a rewrite

Both patch files were almost entirely captured Gradle build output: 2,030 of 2,031 diff blocks
in the background-downloader patch and 1,348 of 1,349 in the voice patch targeted paths under
`node_modules/*/android/build/`. Someone ran `patch-package` after a build.

Only the blocks targeting build output were dropped. The real change in each — resolving the
native module through `TurboModuleRegistry` under bridgeless — is untouched, and this was
verified by reverse-applying each trimmed patch against `node_modules` with
`git apply --check -R`, which passes only if the patch exactly describes what is on disk.

**Do not regenerate these patches after a Gradle build.** That is what produced the 9 MB files
and it will happen again. If you must regenerate, do it against a clean `node_modules` and check
the diff touches only the file you meant to change.

## 4. Preflight has a new status and a new mode

`npm run preflight:beta` previously reported "No preflight blockers found" for a tree that was
debug-signed and carried four unreviewed draft legal documents.

There is now a `BLOCKED` status for work that is fine during beta development but blocks
distribution. `preflight:beta` lists those and still exits 0 — your existing usage is unchanged.
`npm run preflight:public` exits 1 on them. Six checks were added: version consistency between
`app.json` and `build.gradle`, release signing, the permission surface, legal draft status, and
the `TASK_UI_ENABLED` scope flag.

Current state: 11 PASS, 2 BLOCKED (signing, legal drafts), 1 SKIPPED (no Java here).

## 5. `three-forcegraph` is now a declared dependency

`assets/graph/build.js` reads `node_modules/three-forcegraph/dist/three-forcegraph.min.js`
directly, but the package was declared nowhere — it resolved only as a transitive dependency of
`3d-force-graph`, and the Core globe build worked purely on npm's flat hoisting. Now pinned at
`^1.43.4`.

Reminder for graph work generally: `assets/graph/graph.html` is a **build artifact**. Editing
`knowledge-graph.scene.js` alone changes nothing on device; run `node assets/graph/build.js`.

## What Claude could not do, and is waiting on a build machine for

No Android toolchain on the Linux laptop (`java` is not on `PATH`), so nothing since the
2026-07-07 APK is device-verified — not the Core label fix, not the new Research UI, not the
sampling change from 1.0/64/0.95 to 0.7/40/0.9, not the two S25 bug fixes, and not items 1 or 2
above, which are the native-facing ones.

`docs/aether-device-beta-checklist.md` was rewritten for the current scope and is the script to
run. `expo-print` is also now dead weight — artifact export is unreachable with Task hidden —
but removing an Expo native module without a prebuild and Gradle verify is exactly the change
that breaks a build silently, so it was left alone for whoever can build.

Full detail: `claude-notes/release-readiness-2026-07-28.md`.
