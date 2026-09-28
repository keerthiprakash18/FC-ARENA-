# FC ARENA Android (Google Play)

This project packages the production PWA at https://fcarena.in as a Trusted Web Activity (TWA).

## Release identity

- Package / application ID: `in.fcarena.app`
- Version name: `1.0.0`
- Version code: `2`
- Minimum SDK: 24
- Compile SDK: 36
- Target SDK: 36
- Production URL: `https://fcarena.in/dashboard`
- Web manifest: `https://fcarena.in/manifest.webmanifest`

## Build validation

Android CI builds `:app:bundleRelease` without a signing key to verify that the project remains buildable.

## Signed release build

The upload key is intentionally NOT stored in this public repository.

Set these environment variables before a signed release build:

- `FC_ARENA_KEYSTORE_FILE`
- `FC_ARENA_STORE_PASSWORD`
- `FC_ARENA_KEY_ALIAS`
- `FC_ARENA_KEY_PASSWORD`

Then run:

```bash
gradle :app:clean :app:bundleRelease
```

Output:

`app/build/outputs/bundle/release/app-release.aab`

## Digital Asset Links

The web association is stored at:

`apps/web/public/.well-known/assetlinks.json`

Its SHA-256 certificate fingerprint must always match the Play upload signing certificate.
