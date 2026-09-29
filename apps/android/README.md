# FC ARENA Android (Google Play)

FC Arena is packaged as a small native Android WebView shell that loads the production app at https://fcarena.in.

## Release identity

- Package / application ID: `in.fcarena.app`
- Version name: `1.0.4`
- Version code: `6`
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

Android CI performs both:
1. release lint + AAB compilation; and
2. an Android 15 emulator install/launch smoke test that fails if the FC Arena process exits or logs a fatal exception immediately after launch.

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
