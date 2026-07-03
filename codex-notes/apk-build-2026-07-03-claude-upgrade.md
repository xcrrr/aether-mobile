# APK Build - 2026-07-03 Claude Upgrade

## Result

- Built latest Android release APK after Claude's upgrade pass.
- Output copied to `releases/Aether-2.1.0-latest.apk`.
- Size: `137088853` bytes.
- SHA256: `DEA60679F9C1F2824B1FF350A4B94B94C390E2679B2E551609422B766144E0F3`.

## Build Method

- Used clean short-path build copy: `C:\a2`.
- Excluded generated folders from the source copy: `node_modules`, `.next`, `build`, `.gradle`, `.cxx`, `.git`.
- Installed dependencies with `npm.cmd ci` in `app/` and `website/`.
- Built APK with `app/android/gradlew.bat :app:assembleRelease`.

## Validation

- App typecheck: passed.
- App tests: `38` suites, `494` tests passed.
- Website lint: passed.
- Website tests: `8` suites, `21` tests passed.
- Website production build: passed.
- Gradle release build: `BUILD SUCCESSFUL`.

## Notes

- Android/Metro emitted normal React Native release warnings for undeclared runtime globals.
- Gradle lint emitted Kotlin metadata compatibility warnings for LiteRT/Kotlin 2.2/2.3 artifacts, but `assembleRelease` completed successfully.
- Website test maintenance was required after the upgrade:
  - Added SVG `motion.g` and `motion.line` support to the local `framer-motion` Jest mock.
  - Updated the page narrative assertion to match the current Memory heading.
