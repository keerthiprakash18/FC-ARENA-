# FC ARENA Android (Google Play)

FC Arena is packaged as a small native Android WebView shell that loads the production app at https://fcarena.in.

## Release identity

- Package / application ID: `in.fcarena.app`
- Version name: `1.0.6`
- Version code: `8`
- Minimum SDK: 24
- Compile SDK: 36
- Target SDK: 36
- Production URL: `https://fcarena.in/dashboard`
- Delivery format: Android App Bundle (`.aab`)

## Runtime architecture

The Play build no longer depends on Trusted Web Activity / Android Browser Helper startup.

The native shell:
- loads only HTTPS FC Arena pages in-app;
- sends external domains to the system browser;
- enables JavaScript and DOM storage required by the production Next.js app;
- preserves FC Arena cookies and sessions;
- supports Android file selection for profile photos;
- blocks mixed HTTP content and file-system access;
- provides an offline page;
- provides a native fallback screen if WebView initialization fails.

## Validation

Android CI validates release lint and AAB compilation, then builds the debug
wrapper and the current Next.js production frontend on Android API 33, 34, 35
and 36. The test harness routes frontend requests to that checkout and API
requests to isolated fixtures. It never writes production data.

`tests/smoke.mjs` records viewport/document metrics and hit targets, then uses
real `adb shell input swipe` in both directions. A dashboard that does not
scroll fails CI. It checks sticky header/fixed navigation geometry, horizontal
overflow, SPA tab navigation, profile/career, Android back, five resumes and
five fresh process launches. JSON evidence and screenshots are CI artifacts.
Fixture tests do not prove real account persistence or the Android file picker;
those require the Play-installed physical-device acceptance test.

Local browser touch checks cover 360, 375, 390, 412, 430 and 768 CSS pixels:
start the production web server on port 3000, install `tests` dependencies and
Playwright Chromium, then run `node apps/android/tests/smoke.mjs` from repo root.
`CHROMIUM_PATH` optionally selects an installed Chromium binary.

Release WebView debugging is disabled; debug builds enable it for CDP tests.
Native system insets reserve space for system bars/keyboard; CSS safe-area
padding applies only to any remaining WebView inset, preventing overlap.

## Signed release build

The private upload key is intentionally NOT stored in this public repository.

Set:
- `FC_ARENA_KEYSTORE_FILE`
- `FC_ARENA_STORE_PASSWORD`
- `FC_ARENA_KEY_ALIAS`
- `FC_ARENA_KEY_PASSWORD`

Then run from `apps/android`:

```bash
gradle :app:clean :app:bundleRelease
```

Output:

`app/build/outputs/bundle/release/app-release.aab`

## Digital Asset Links

The production association remains at:

`apps/web/public/.well-known/assetlinks.json`

It contains the Google Play app-signing certificate fingerprints and the FC Arena upload-key fingerprint.
