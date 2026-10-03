# Step 18 — Production Release System

Status: COMPLETE AT REPOSITORY LEVEL. The final signed artifact is created only after Step 20 passes.

Last reviewed: 3 October 2026

## Single source of version truth

Android package version is read from:

`apps/android/version.properties`

Known Play upload history is recorded in:

`apps/android/play-upload-history.json`

The release gate requires the candidate `VERSION_CODE` to be strictly greater than the highest versionCode known to have been uploaded to any Play track. The history file must be updated immediately after every Play upload.

Current recorded state:

- Highest known uploaded: versionCode 11 / versionName 1.0.9.
- Final candidate: versionCode 12 / versionName 1.0.10.
- Package: `in.fcarena.app`.

## Source freeze

A final Android artifact may be built only when:

1. branch is `main`;
2. local HEAD equals `origin/main`;
3. tracked/staged source is clean;
4. final release gate passes;
5. web/API/security/Android validation is green for the frozen source;
6. current web frontend represented by that source has been deployed successfully;
7. API health is healthy;
8. the candidate versionCode is unused in Play.

The existing PowerShell signing helper already enforces clean/current main and verifies the known FC ARENA upload certificate before and after building.

## Artifact traceability

The signed release helper writes:

- filename
- versionCode
- versionName
- package name
- exact Git source SHA
- upload-certificate SHA-256
- AAB file SHA-256

Expected filename pattern:

`FC_ARENA_v<versionName>_build<versionCode>_signed.aab`

Do not rename/re-sign a different source artifact and present it as the same release.

## Release order

1. Complete Steps 16–19.
2. Merge one final readiness PR to `main`.
3. Confirm production web/API deployments correspond to final source.
4. Run Step 20 gate.
5. Build exactly one final signed AAB with the existing upload key.
6. Verify signer and file SHA-256.
7. Install/update through a Play testing track.
8. Complete final physical-device smoke, Crashlytics and push verification.
9. Record artifact SHA/source SHA in the release registry.
10. Upload/promote the same artifact through the required Play testing/production process.

## Android release registry

FC ARENA already has an authenticated SUPER_ADMIN Android release registry. Version codes are unique, published records are immutable, and publishing rejects non-monotonic version codes inside a channel.

Recommended final record fields:

- versionCode
- versionName
- channel
- release notes
- source commit
- artifact SHA-256
- Play Store URL when available

Do not mark a release `PUBLISHED` in the FC ARENA registry before the corresponding Play release is actually available in that channel.

## Release notes

Release notes must describe user-visible changes without claiming unverified properties such as "100% secure", "zero bugs", or production capacity that has not been measured on production hardware.

## Signing rules

- Reuse only the existing FC ARENA upload keystore.
- Expected upload certificate SHA-256 is enforced by `build-signed-release.ps1`.
- Never commit the keystore or passwords.
- Do not rotate the upload key during this release.
- No unsigned CI bundle is a Play upload artifact.

Step 18 is complete when these controls are present and validated. The signed artifact itself belongs to Step 20.
