# Android gray-screen boot fix - 2026-06-30

## Summary

User reported the release APK opened to a plain gray screen. The likely failure point was app startup before the root layout rendered, caused by Expo Router evaluating route modules with native-heavy top-level imports. The fix hardened startup by lazy-loading model, inference, voice, picker, file-processing, downloader, clipboard, and Core/WebView paths, and by disabling React Native New Architecture for compatibility with the current native dependency set.

## Important code changes

- `app.json` and `android/gradle.properties`: `newArchEnabled=false`.
- `android/gradle.properties`: `kotlin.incremental=false` to avoid mixed-root Kotlin cache failures during Windows short-path builds.
- `android/app/build.gradle`: Android release bundling now resolves the Expo Router entry through `expo/scripts/resolveAppEntry`.
- `_layout.tsx`: removed `KeyboardProvider` and root model-store hydration from first render.
- Main route hydrates model store after shell render.
- Settings, chat store, model store, inference hook, voice hook, file picker/attachment code, and clipboard usage now lazy-load native modules.
- `second-brain` route lazy-loads the Core/WebView screen to keep WebView/Galaxy imports out of route discovery.
- `pnpm-lock.yaml`: updated to Source Serif 4 only; removed old Literata/Playfair lock entries.

## Build notes

Windows long paths caused `react-native-reanimated` CMake/Ninja failures when building from the Desktop path. A real short-path copy was made at `C:\aeb`, then `pnpm install --no-frozen-lockfile --force --config.confirmModulesPurge=false` was run there so `node_modules` and autolinking pointed to `C:\aeb` instead of the Desktop tree.

Before the successful build, `C:\aeb\android\build`, `C:\aeb\android\.gradle`, and `C:\aeb\android\app\build` were cleared, and `:app:generateAutolinkingPackageList` was verified to point `react-native-reanimated` to `C:\aeb\node_modules\react-native-reanimated\android`.

Build command:

```powershell
cd C:\aeb\android
$env:NODE_ENV='production'
.\gradlew.bat assembleRelease
```

Build succeeded. Lint emitted Kotlin metadata complaints for LiteRT/kotlin-reflect, but `:app:assembleRelease` completed and produced the APK.

## Artifacts

- `C:\Users\PC\Desktop\Aether-2.1.0-latest.apk`
- `C:\Users\PC\Desktop\Aether-2.1.0-gray-screen-fix.apk`
- `C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29\releases\Aether-2.1.0-latest.apk`
- `C:\Users\PC\Documents\Aether\releases\Aether-2.1.0-latest.apk`
- `C:\Users\PC\Documents\Aether\releases\Aether-2.1.0-gray-screen-fix.apk`

SHA-256:

```text
00EF1D1BFD4A98571AED4DF7AA120251441899E7D04F4A1F4ADA80A833F95659
```

APK metadata:

- Package: `com.aether.app`
- Version: `2.1.0`
- Version code: `4`
- Min SDK: `29`
- Target SDK: `34`
- Native ABIs: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`

## Verification

- `npm.cmd run typecheck` passed.
- `npm.cmd test -- --runInBand` passed: 21 suites, 192 tests.
- Built JS bundle contains Source Serif tokens and does not contain Literata/Playfair tokens.
- APK contains LiteRT native libraries (`libLiteRt.so`, `liblitertlm_jni.so`).
- No Android device was attached over ADB, so on-device launch/logcat verification was not possible in this session.

