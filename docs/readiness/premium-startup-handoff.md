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
- The bracket trophy uses the shared motion token and appears only when existing verified final results identify a champion. The winner text is visible immediately. The trophy icon stays static under reduced motion. Bracket controls can wrap between buttons at narrow widths and keep each control label on one line.
- Registration, match submission, correction, standings, player, and admin screens continue to use their existing implementations. This change covers startup continuity and the champion presentation.

## D. Opening animation

- AndroidX hands off from the system splash to a native view in the existing Activity. Its official crest comes from the same generated resource as the launcher. Native canvas paints dark blue floodlight, a converging pitch line, a center circle, and the tagline. The browser uses the existing login and dashboard loading routes directly.
- The original motion runs for 800 ms when loading permits it. The first visual state callback for the current WebView document starts a 120 ms opacity handoff. A 1,200 ms deadline measured from the first native reveal draw removes the decorative layer. During an ongoing document request, the existing progress bar and the native connecting message remain until the WebView paints or recovery takes over. Reduced-motion, low-memory, and software-rendering modes use the static crest. Recovery and Activity lifecycle events remove the startup presentation.
- The final run used Android 15/API 35 and WebView 124.0.6367.219 on the same emulator, with a local proxy simulating a slow unavailable connection. Five cold launches per build had median `am start -W TotalTime` of 3,260 ms on baseline and 2,895 ms on the candidate. Five resume samples had median `WaitTime` of 159 ms and 260 ms. Cold sample ranges were 2,308–4,935 ms and 2,835–5,041 ms. The order and spread limit performance conclusions. These samples cover Android Activity display and resume. Authenticated WebView readiness remains unmeasured.
- The final candidate debug APK was captured with Android `screenrecord`. The recording and raw ADB samples are available in the local QA evidence directory. [Timing design and test matrix](premium-startup-design.md)

## E. Quality verification

- Baseline and candidate Android debug builds, Android lint, and 32 Robolectric tests on API 28 and 35 passed. Startup scenarios cover the visual handoff, the bounded timeout and loading message, stale navigation, Activity restoration, resume, and renderer recovery. The unsigned release build and release lint passed. The first local release build invoked the repository's configured Crashlytics mapping task. The follow-up local release check explicitly excluded that task.
- Web ESLint, TypeScript, and the local production Webpack build passed. Six Playwright tests passed on the production build for desktop and a narrow mobile viewport. Tests exercise sign-in, keyboard navigation, delayed Home data, reduced motion, API failure, and recovery. Private and public brackets passed at 390 px and 1,280 px. Home regressions passed at 320 px, 390 px, and 1,280 px, including the opponent privacy prompt and saved dashboard preferences.
- 61 targeted repository regression checks passed. API unit and loopback HTTP checks passed 865 tests with 5 skipped. The standard API build passed with fresh Prisma generation. The baseline `build:quality` initially rejected four checked-in missing generated model files, which the standard build creates. Generated build outputs are excluded from this change.
- All 48 existing migrations applied to disposable PostgreSQL. Targeted HTTP integration checks passed 63 assertions across the Redis-backed rerun and a fresh registration-review database. The reruns resolved the initial missing-Redis teardown and the repeated fixture-identity collision. Windows denied the screenshot containment test's symlink. The initial PR revision passed the full API E2E suite on Linux CI. The loopback databases used synthetic data exclusively.
- The Readiness Steps 11–15 job exposed an intermittent failure in the PostgreSQL serialization test. Its barrier now waits for both initial reads before either write can proceed, ensuring the test creates the intended conflict. The corrected test passed three targeted runs against disposable PostgreSQL and Redis. [Original CI failure](https://github.com/keerthiprakash18/FC-ARENA-/actions/runs/43725055328/job/132845070363)
- The npm runtime audit found one existing low-severity `fast-xml-parser` advisory and zero moderate, high, or critical advisories. The Android dependency uses the stable AndroidX SplashScreen library from Google Maven. [AndroidX release information](https://developer.android.com/jetpack/androidx/releases/core)

## F. GitHub

- `bc642f0` adds the bounded native launch and lifecycle tests. `362b079` adds Home and trophy changes, Playwright tests, and CI integration. The initial draft revision passed all 13 GitHub checks. The final head and check state are tracked on [draft PR #166](https://github.com/keerthiprakash18/FC-ARENA-/pull/166).

## G. Production readiness and storage

Release readiness is pending independent Goldfish review, candidate CI, and complete Android launch and staging evidence. Obtain a recent encrypted database backup, verify its isolated restore and compatibility, rehearse rollback, and verify the deployed commit and health checks on a separately authorized release. The default account from the existing trusted SSH configuration reached the VCCL host but authentication was denied. Live disk, backup timers, off-server copy, log retention, and Cloudinary usage remain unverified.

The repository supports GPG encrypted PostgreSQL dumps and off-server copying of encrypted archive and checksum pairs via rclone. The Arena Talk helper writes local gzip archives with restrictive permissions and checksums. Verify how those media archives are encrypted and restored before including them in an off-server copy. Use the existing host and storage volumes to inventory database and WAL size, Docker layers, release outputs, temporary files, system logs, and media retention before making any capacity changes. [Backup runbook](../../ops/backup/README.md) · [Release and rollback](step-19-rollback-dr.md)

## H. Remaining work

1. Install EGM Desktop and complete an independent Goldfish review of the startup design and implementation.
2. Verify physical-device launches and staging WebView behavior, including app links, push routing, reduced motion, assistive technology, and the first useful authenticated dashboard frame.
3. Confirm same-commit CI, including the Linux screenshot storage containment check.
4. Validate production backup and storage configuration through the trusted operator account, then use the existing release checklist for any later authorization.
5. Audit player profile and admin workflows against the same visual and accessibility standards before selecting further changes.
