# APK Build - 2026-07-03 Codex Low-Memory Rebuild

## Result

- Built a fresh Android release APK from the current `app/` source.
- Output copied to `releases/Aether-2.1.0-latest.apk`.
- Size: `137140893` bytes (`131M` by `ls -lh`).
- SHA256: `1473d2f0c27e3fdd181a9f0ca6e6828d402b99060c59ca9cb9183d08c082e2e7`.

## Build Method

- Used clean scratch build copy: `/tmp/aether-apk-build`.
- Copied source from `app/`, excluding generated folders: `node_modules`, `.expo`, `.gradle`, `build`, `.cxx`, `.git`.
- Installed dependencies with `npm ci`; `patch-package` applied both local native patches.
- Ran `npm run typecheck`.
- Built APK with a low-memory Gradle profile for the 12 GB RAM machine:

```bash
cd /tmp/aether-apk-build/android
env \
  JAVA_HOME=/home/xcrr/.local/android-build/jdk \
  ANDROID_HOME=/home/xcrr/.local/android-build/sdk \
  ANDROID_SDK_ROOT=/home/xcrr/.local/android-build/sdk \
  PATH=/home/xcrr/.local/android-build/jdk/bin:/home/xcrr/.local/android-build/sdk/platform-tools:/home/xcrr/.local/android-build/sdk/cmdline-tools/latest/bin:/usr/bin:/bin \
  NODE_ENV=production \
  ./gradlew --no-daemon --max-workers=1 \
    -Dorg.gradle.jvmargs='-Xmx1536m -XX:MaxMetaspaceSize=384m -Dfile.encoding=UTF-8' \
    -Dkotlin.compiler.execution.strategy=in-process \
    :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Validation

- App typecheck: passed.
- Gradle release build: `BUILD SUCCESSFUL`.

## Notes

- The first default-memory Gradle run was interrupted before APK output.
- The low-memory rerun reused completed scratch intermediates and finished successfully.
- React Native release bundle warnings and Kotlin metadata compatibility messages appeared during lint, consistent with prior LiteRT/Kotlin build notes.
