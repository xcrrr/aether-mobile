# Cleanup Log - 2026-07-02

Request: remove old Aether folders, old APK files, and generated workspace clutter while keeping the active clean workspace.

## Kept

- `C:\Users\PC\Desktop\Aether-Newest-CLEAN-2026-06-29`
- `releases/Aether-2.1.0-latest.apk`

## Removed From Desktop

- `C:\Users\PC\Desktop\aether`
- `C:\Users\PC\Desktop\aether tower`
- `C:\Users\PC\Desktop\aether_repo`
- `C:\Users\PC\Desktop\aether-website`
- `C:\Users\PC\Desktop\aether.zip`
- `C:\Users\PC\Desktop\aether-website.zip`
- `C:\Users\PC\Desktop\Aether-release.apk`
- `C:\Users\PC\Desktop\Aether-2.1.0-gray-screen-fix.apk`
- `C:\Users\PC\Desktop\Aether-2.1.0-gray-screen-fix-v2.apk`
- `C:\Users\PC\Desktop\Aether-2.1.0-grey-screen-fix.apk`
- `C:\Users\PC\Desktop\Aether-2.1.0-latest.apk`
- `C:\Users\PC\Desktop\Aether-model-loading-preview.png`

## Removed From Workspace

- `app/node_modules`
- `website/node_modules`
- `website/.next`
- `app/android/.gradle`
- `app/android/build`
- `app/android/app/build`
- `app/android/app/.cxx`
- Older APKs in `releases/`, leaving only `Aether-2.1.0-latest.apk`
- Root marker `.latest_desktop_copy_path.txt`, which only repeated the current workspace path and was not referenced elsewhere.

## Notes

- A running Next dev server from `website/` was stopped because it locked `website/node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`.
- Dependencies and build outputs can be regenerated when actively building or testing.
- Keep loose Aether APK copies off the Desktop unless the user asks for a quick-install copy.
