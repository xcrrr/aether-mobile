# APK Build - 2026-07-03 Second Rebuild

## Result

- Rebuilt Android release APK from the current `app/` source.
- Output copied to `releases/Aether-2.1.0-latest.apk`.
- Size: `137096669` bytes.
- SHA256: `B3BC6A9BA5CB0EA38A16002373C402782FB0FFD07903F67371C0E0F02CA74184`.

## Build Method

- Ran `npm.cmd ci` in the source app; `patch-package` applied both local patches.
- Ran source app typecheck: `npm.cmd run typecheck`.
- Built from fresh short-path copy: `C:\aether-apk-rebuild-20260703`.
- Excluded generated folders from the copy: `node_modules`, `.expo`, `.gradle`, `build`, `.cxx`, `.git`.
- Ran `npm.cmd ci` and `npm.cmd run typecheck` in the short copy.
- Built with:

```powershell
cd C:\aether-apk-rebuild-20260703\android
$env:NODE_ENV='production'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Validation

- Typecheck: passed in source app and short build copy.
- Jest: `38` suites, `500` tests passed.
- Gradle release build: `BUILD SUCCESSFUL`.

## Notes

- Gradle emitted the known LiteRT/Kotlin metadata compatibility messages during lint-vital, but release assembly completed successfully.
- Metro/React Native emitted normal release bundle global warnings.
