# FC ARENA — Google Play Closed-Test Release

## Android identity

- App name: FC ARENA
- Package name: `in.fcarena.app`
- Version: `1.0.4`
- Version code: `6`
- Target API: `36`
- Delivery format: Android App Bundle (`.aab`)
- Architecture: Native Android WebView shell
- Production origin: `https://fcarena.in`

## Upload signing certificate

The existing FC Arena upload key is retained. Do not rotate or replace it for this release.

## Production domain verification

`https://fcarena.in/.well-known/assetlinks.json` contains the Google Play app-signing SHA-256 fingerprints plus the upload-key fingerprint.

## Closed-test release gate

1. Android release lint passes.
2. AAB compilation passes.
3. Android emulator launch smoke passes.
4. Frontend CI passes.
5. CodeQL passes.
6. Sign the AAB with the existing private FC Arena upload key.
7. Upload versionCode 6 to Closed testing.
8. Install/update from Google Play and verify launch, login, league, tournament, fixtures, profile photo upload, and logout/login.
