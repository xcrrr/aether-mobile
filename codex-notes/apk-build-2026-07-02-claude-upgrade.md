# APK Build - 2026-07-02 Claude Upgrade

Built after the user's note that Claude had just upgraded the local workspace.

## Source

- Workspace: `C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29`
- Build copy: `C:\a2`
- Build command: `npm.cmd ci`, `npm.cmd run typecheck`, then `.\gradlew.bat :app:assembleRelease`

## Result

- Artifact: `releases/Aether-2.1.0-latest.apk`
- Size: `137086629` bytes
- SHA256: `8DA2AEAFADA7AB9982DB81F3947855D188C4BFCD52AD12F1C9C1B562CBCC4AFF`

## Validation

- `npm.cmd ci` completed and `patch-package` applied both local patches.
- `npm.cmd run typecheck` passed.
- `npm.cmd test -- --runInBand` passed: 38 suites, 482 tests.
- Gradle release build completed with `BUILD SUCCESSFUL`.

## Notes

- Gradle lint printed Kotlin metadata compatibility messages for LiteRT/Kotlin 2.2+ dependencies during `lintVitalRelease`, but the release APK task still completed successfully.
- Jest printed a React `act(...)` warning from the animated typing indicator test path, but all tests passed.
- Generated dependency/build folders remain excluded from the active workspace and GitHub sync.
