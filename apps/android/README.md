# FC ARENA Android (Google Play)

FC Arena is packaged as a small native Android WebView shell that loads the production app at https://fcarena.in.

## Release identity

- Package / application ID: `in.fcarena.app`
- Version name: `1.0.7`
- Version code: `9`
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

The private FC Arena upload key is intentionally NOT stored in this public repository.

On Windows, use the release helper from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\android\build-signed-release.ps1
```

The script:
- requires `main` to match the latest `origin/main`;
- verifies Build 9 / version `1.0.7`;
- prompts locally for the existing upload keystore path, alias, and passwords;
- never writes passwords to the repository;
- verifies the upload certificate SHA-256 before and after signing;
- downloads and SHA-256-verifies official Gradle 8.13 only if Gradle is not installed;
- builds the signed release AAB;
- writes the final artifact to `apps/android/release/FC_ARENA_v1.0.7_build9_signed.aab`;
- writes a companion SHA-256/source-commit metadata file.

The `apps/android/release/` directory and private keystores are git-ignored.

The upload certificate expected by the helper is the original FC Arena upload key retained in Digital Asset Links:
`8E:D9:C7:3B:EF:2F:66:21:5F:7F:8C:91:7B:A8:32:B2:02:CC:4F:C4:34:6C:A9:87:40:63:0B:87:1A:DE:60:6D`.

For non-Windows environments, the Gradle build still supports:
- `FC_ARENA_KEYSTORE_FILE`
- `FC_ARENA_STORE_PASSWORD`
- `FC_ARENA_KEY_ALIAS`
- `FC_ARENA_KEY_PASSWORD`

Then run `gradle :app:clean :app:bundleRelease` from `apps/android`.

## Digital Asset Links

The production association remains at:

`apps/web/public/.well-known/assetlinks.json`

It contains the Google Play app-signing certificate fingerprints and the FC Arena upload-key fingerprint.
