# Current verification baseline

Verified from the active `main` checkout at `6d26070` on 2026-07-14 09:30 CEST.
This record supersedes historical test-count claims; historical notes remain valid only for
the commits and milestones they describe.

## Results

| Surface | Check | Result |
| --- | --- | --- |
| App | `npm ci` | Pass; both patch-package patches applied |
| App | `npm run typecheck` | Pass |
| App | `npm test -- --runInBand` | Pass: 43 suites, 538 tests |
| App | `npm run preflight:beta` | Pass with Java/APK build skipped |
| Website | `npm ci` | Pass with Babel peer and lifecycle-script warnings |
| Website | `npm run lint` | Pass |
| Website | `npm test -- --runInBand` | Pass: 8 suites, 21 tests |
| Website | `npm run build` | Pass: 4 static routes generated |

The stale homepage expectations were aligned with the authoritative current product: the
narrative test covers the current hero, accessible mission region, memory and capabilities,
and the anchor test covers exactly the three sections linked by the main navigation. The
separate guard against absolute privacy claims remains active.

## Release and environment gaps

- `releases/Aether-2.1.0-latest.apk` is documented but absent from this checkout, so the
  active source cannot yet be tied to or installation-tested against that artifact.
- Java is unavailable on `PATH`; preflight therefore skipped the Android build.
- The app install reported 24 dependency vulnerabilities (17 moderate, 6 high, 1 critical).
  The website install reported 3 moderate vulnerabilities. These counts require a scoped
  dependency audit before release; no automatic or breaking upgrades were applied.
- App tests pass with two React `act(...)` warnings from the animated typing indicator.
- The website build warns that Next.js inferred `/home/xcrr` as the workspace root because
  multiple lockfiles exist.

No APK was built, replaced, published, or deployed in this milestone.
