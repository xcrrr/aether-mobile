# Dev Environment (this Windows device)

Set up 2026-06-29 so UI work can be verified locally.

## Toolchain

- **Node**: portable install at `C:\Users\PC\node-v24.18.0-win-x64` (v24.18.0, npm 11.16.0).
  Added to the **User** PATH. A fresh shell picks it up; if a tool can't find `node`,
  prepend that dir to PATH.
- **Package manager: npm (canonical).** The project installs flat via npm
  (`package-lock.json` + `.npmrc legacy-peer-deps=true`; CLAUDE.md says `npm test` /
  `npm run typecheck`). `postinstall` runs `patch-package` (patches in `patches/`).
- **Do NOT install with pnpm here.** pnpm's symlinked `.pnpm` layout breaks jest-expo's
  `transformIgnorePatterns` (RN flow-typed polyfills fail to transform → all suites fail
  to even start). npm's flat `node_modules` runs jest fine.

## Verify commands (run from `app/`)

```
npm install          # 1138 pkgs, applies patches
npm run typecheck    # tsc --noEmit  -> expect EXIT 0
npm test             # jest          -> expect 207 passed, 23 suites
```

Baseline on a clean npm install: **typecheck 0 errors, 207/207 tests pass.** Treat that
as the green bar — any UI change must keep it green.

> Note: a *pnpm* install instead shows 14 phantom `Cannot find name 'global'` typecheck
> errors in `webresearch` tests (different @types/node resolution). npm install = clean.
> If you see those, you installed with the wrong PM.

## Building the APK

Native Android build still needs Android Studio / Gradle + JDK (see `app/CLAUDE.md`). Not
set up on this device yet — typecheck + jest are the only local nets here. Pixel-level
visual QA still needs a real device or Expo run.
