# APK Build - 2026-07-03 Codex Fresh Build

## Result

- Built a fresh Android release APK from the current `app/` source.
- Output copied to `releases/Aether-2.1.0-latest.apk`.
- Size: `137091629` bytes (`130.74 MB`).
- SHA256: `B527111CDD79060E8DD7AF5738C9D4768EF6A9F56D4E929B5F0736DD41086D5A`.

## Build Method

- Used clean short-path build copy: `C:\a5`.
- Copied source with `robocopy`, excluding generated folders: `node_modules`, `.expo`, `.gradle`, `build`, `.cxx`, `.git`.
- Installed dependencies with `npm.cmd ci`; `patch-package` applied both local native patches.
- Ran `npm.cmd run typecheck`.
- Built APK with:

```powershell
$env:NODE_ENV='production'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Validation

- App typecheck: passed.
- Gradle release build: `BUILD SUCCESSFUL`.

## Notes

- Android/Metro emitted normal React Native release warnings for undeclared runtime globals.
- Gradle lint emitted known Kotlin metadata compatibility warnings for LiteRT/Kotlin 2.2/2.3 artifacts, but `assembleRelease` completed successfully.
- No code changes were made for this build.
