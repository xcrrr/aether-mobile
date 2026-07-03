# APK Build - 2026-07-03 Core Hydration Rebuild

## Result

- Rebuilt Android release APK from the current patched `app/` source after Claude's Core hydration fix.
- Output copied to `releases/Aether-2.1.0-latest.apk`.
- Size: `137092109` bytes.
- SHA256: `1AABC3CA67A3F126E3BA69BE4337D7863692D58692222C64C4FCEA7C97BC4378`.

## Build Method

- Ran patched install in the source app: `npm.cmd ci`; `patch-package` applied both local patches.
- Ran source app typecheck: `npm.cmd run typecheck`.
- Built from clean short-path copy: `C:\aether-apk-build-20260703`.
- Excluded generated dependency/build folders from the short copy: `node_modules`, `.expo`, `.gradle`, `build`, `.cxx`, `.git`.
- Ran patched install and typecheck in the short copy.
- Built APK with:

```powershell
cd C:\aether-apk-build-20260703\android
$env:NODE_ENV='production'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Validation

- App typecheck: passed.
- App tests: `38` suites, `500` tests passed.
- Gradle release build: `BUILD SUCCESSFUL`.

## Notes

- Gradle emitted the known LiteRT/Kotlin metadata compatibility messages during lint-vital, but `assembleRelease` completed successfully.
- Android/Metro emitted normal React Native release warnings for undeclared runtime globals.
- Real Android cold-start Core recall still needs on-device confirmation with `adb logcat | grep CoreDebug`, as described in `claude-notes/core-hydration-fix-2026-07-03.md`.
