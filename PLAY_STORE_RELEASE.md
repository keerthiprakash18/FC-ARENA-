# FC ARENA — Google Play Release 1

## Android identity

- App name: FC ARENA
- Package name: `in.fcarena.app`
- Version: `1.0.0`
- Version code: `1`
- Target API: `36`
- Delivery format: Android App Bundle (`.aab`)
- Architecture: Trusted Web Activity (TWA)
- Production origin: `https://fcarena.in`

## Upload signing certificate

SHA-256:

`8E:D9:C7:3B:EF:2F:66:21:5F:7F:8C:91:7B:A8:32:B2:02:CC:4F:C4:34:6C:A9:87:40:63:0B:87:1A:DE:60:6D`

The private upload keystore and passwords are NOT committed to GitHub.

## Digital Asset Links

Production must serve:

`https://fcarena.in/.well-known/assetlinks.json`

Repository source:

`apps/web/public/.well-known/assetlinks.json`

## First release gate

1. Android CI passes.
2. Vercel deploys the Digital Asset Links file.
3. Live Digital Asset Links is verified.
4. Signed AAB is built with the protected upload key.
5. Release build is tested on an Android phone.
6. Signed AAB is uploaded to Play Console Closed Testing.
7. Package name and signing key remain unchanged for future versions.
