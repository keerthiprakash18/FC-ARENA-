# FC Arena premium startup handoff

## A. Tool setup

- Microsoft Playwright MCP was installed in Codex and opened the local FC Arena sign-in page. Playwright Test 1.58.2 now matches the version in the existing browser harness and runs in the Android CI workflow.
- EGM Desktop installation and independent Goldfish review are pending. The owner approved implementation with Goldfish retained as a release gate. [Official Desktop installation](https://egm.dev/install/)
- The design uses FC Arena's existing logo, Geist, and theme tokens. Mobbin informed the dashboard hierarchy and Aceternity was evaluated. The web animation uses CSS and adds zero web runtime dependencies. [Design references and tool checks](premium-startup-preflight.md)

## B. Application audit

- The original working tree contained substantial active work. The implementation is isolated on `codex/premium-startup` from GitHub `main` at `2b50f0ae358d1c9ffca306fc800a1dcd2876bbd4`. Current main already contains Duo and cross-play scoring, league membership checks, confirmed results, and opponent WhatsApp consent. [Source and regression inventory](premium-startup-preflight.md)
- The candidate uses the existing trusted WebView origin, launch destination, navigation, auth cookie bridge, offline retry, and renderer recovery. Competition calculations, permissions, schema, and player data are outside the code diff.

## C. UI and UX implementation

- Home now uses the shared loading status and skeleton primitive with the same visual order as the live Home view. The loading skeleton uses the existing arena palette and respects reduced motion.
- The bracket trophy uses the shared motion token and appears only when existing verified final results identify a champion. The winner text is visible immediately. The trophy icon stays static under reduced motion.
- Registration, match submission, correction, standings, player, and admin screens continue to use their existing implementations. This change covers startup continuity and the champion presentation.

## D. Opening animation

- AndroidX hands off from the system splash to a native view in the existing Activity. Its official crest comes from the same generated resource as the launcher. Native canvas paints dark blue floodlight, a converging pitch line, a center circle, and the tagline. The browser uses the existing login and dashboard loading routes directly.
- The original motion runs for 800 ms when loading permits it. The first visual state callback for the current WebView document starts a 120 ms opacity handoff. A 1,200 ms deadline releases the native overlay even if no frame arrives. The deadline starts when the Activity attaches the overlay and does not include time spent in system process startup. Reduced-motion, low-memory, and software-rendering modes use the static crest. Recovery and Activity lifecycle events remove the overlay.
- Compare baseline and candidate debug builds on the same device and network profile. Android `am start -W` measures native launch reporting. A screen recording is required separately to measure the first useful WebView frame and inspect the visual transition. [Timing design and test matrix](premium-startup-design.md)

## E. Quality verification

- Baseline and candidate Android debug build, Android lint, and Robolectric on API 28 and 35 passed. Startup regressions cover cold timeout, visual handoff, stale navigation, Activity restoration, resume, and renderer recovery.
- Web ESLint, TypeScript, and the local production Webpack build passed. Six Playwright tests passed on the production build for desktop and a narrow mobile viewport. Tests exercise sign-in, keyboard navigation, delayed Home data, reduced motion, API failure, and recovery. Verified champion brackets passed in browser regression tests at 390 px and 1,280 px.
- 61 targeted repository regression checks passed. API unit and loopback HTTP checks passed 865 tests with 5 skipped. The standard API build passed with fresh Prisma generation. The baseline `build:quality` initially rejected four checked-in missing generated model files, which the standard build creates. Generated build outputs are excluded from this change.
- All 48 existing migrations applied to disposable PostgreSQL. The first integration pass returned 52 assertions passed and one failed, with one additional suite teardown failure. Windows denied creation of a test symlink, and account deletion teardown could not connect to Redis. The IPv4 loopback database used synthetic data exclusively.
- The npm runtime audit found one existing low-severity `fast-xml-parser` advisory and zero moderate, high, or critical advisories. The Android dependency uses the stable AndroidX SplashScreen library from Google Maven. [AndroidX release information](https://developer.android.com/jetpack/androidx/releases/core)

## F. GitHub

- `bc642f0` adds the bounded native launch and lifecycle tests. `362b079` adds Home and trophy changes, Playwright tests, and CI integration. The isolated branch is based on verified upstream source.

## G. Production readiness and storage

Release readiness is pending independent Goldfish review, candidate CI, and complete Android launch and staging evidence. Obtain a recent encrypted database backup, verify its isolated restore and compatibility, rehearse rollback, and verify the deployed commit and health checks on a separately authorized release. The default account from the existing trusted SSH configuration reached the VCCL host but authentication was denied. Live disk, backup timers, off-server copy, log retention, and Cloudinary usage remain unverified.

The repository supports GPG encrypted PostgreSQL dumps and off-server copying of encrypted archive and checksum pairs via rclone. The Arena Talk helper writes local gzip archives with restrictive permissions and checksums. Verify how those media archives are encrypted and restored before including them in an off-server copy. Use the existing host and storage volumes to inventory database and WAL size, Docker layers, release outputs, temporary files, system logs, and media retention before making any capacity changes. [Backup runbook](../../ops/backup/README.md) · [Release and rollback](step-19-rollback-dr.md)

## H. Remaining work

1. Install EGM Desktop and complete an independent Goldfish review of the startup design and implementation.
2. Finish the native device evidence and verify fresh and existing installs, background return, deep links, push navigation, network failure, and assistive technology on the current Android CI matrix and a representative physical phone.
3. Confirm same-commit CI and complete the remaining HTTP and PostgreSQL checks in a Linux runner, including the screenshot storage containment test.
4. Verify production backup and storage configuration via the trusted operator account, then use the existing release checklist for any later authorization.
