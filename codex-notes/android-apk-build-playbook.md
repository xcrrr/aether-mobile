# Android APK build playbook

Use this for future local APK builds on Windows.

## Why the short build path matters

Building directly from the Desktop workspace can fail in CMake/Ninja because React Native native modules generate paths longer than Windows/CMake likes, especially `react-native-reanimated`.

Observed failure:

`react-native-reanimated:buildCMakeRelWithDebInfo[arm64-v8a] FAILED`

with Ninja errors under long paths from:

`C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\app\node_modules\...`

The successful build used a fresh short-path copy:

`C:\a2`

## Recommended build steps

From the main workspace:

1. Read `README.md` and `codex-notes/latest-context.md`.
2. Make code changes in the real app workspace:

   `C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\app`

3. Run typecheck with `npm.cmd`, not `npm`, because PowerShell may block `npm.ps1`:

   ```powershell
   npm.cmd run typecheck
   ```

4. Create a short clean build copy. Prefer a fresh short directory that does not already exist, for example `C:\a2` or `C:\aether-build`.

   Use `robocopy`, excluding generated dependency/build folders. If exclusions miss anything, remove generated Android folders afterward.

   ```powershell
   robocopy "C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\app" "C:\a2" /E /XD node_modules .expo .gradle build .cxx
   ```

5. In the short copy, install dependencies from the lockfile:

   ```powershell
   cd C:\a2
   npm.cmd ci
   ```

   Confirm `patch-package` applies the local patches.

6. Typecheck the short copy:

   ```powershell
   npm.cmd run typecheck
   ```

7. Build release APK from the short copy:

   ```powershell
   cd C:\a2\android
   $env:NODE_ENV='production'
   .\gradlew.bat :app:assembleRelease
   ```

8. Copy the APK back:

   ```powershell
   $src = 'C:\a2\android\app\build\outputs\apk\release\app-release.apk'
   Copy-Item -LiteralPath $src -Destination 'C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\releases\Aether-2.1.0-latest.apk' -Force
   Copy-Item -LiteralPath $src -Destination 'C:\Users\PC\Desktop\Aether-2.1.0-latest.apk' -Force
   ```

9. Verify size/hash:

   ```powershell
   Get-Item -LiteralPath 'C:\Users\PC\Desktop\Aether-2.1.0-latest.apk'
   Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\PC\Desktop\Aether-2.1.0-latest.apk'
   ```

## Cleanup notes

Stop Gradle before deleting the short copy:

```powershell
cd C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\app\android
.\gradlew.bat --stop
```

Then remove the short copy:

```powershell
Remove-Item -LiteralPath 'C:\a2' -Recurse -Force
```

If Windows still says files are in use, leave `C:\a2` and remove it after a short wait or after reboot. This is only scratch build output, not active source.

## Last known successful APK

Date: 2026-07-02

Changes included:

- Focused typography redesign: Newsreader for assistant/editorial voice and Instrument Sans for interface UI.
- Removed Source Serif 4 and Inter font packages from the active app build.
- Added centralized typography roles and development typography preview route.

Artifact:

`C:\Users\PC\Desktop\Aether-2.1.0-latest.apk`

SHA256:

`3C02C2CE53FF4F316AE0C9054BC58E9A603324311F060739BA7D046A6286CE2B`
