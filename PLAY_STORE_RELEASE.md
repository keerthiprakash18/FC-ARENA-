# FC ARENA — Final Android Play Release Runbook

Current final candidate: **versionCode 11 / versionName 1.0.9**
Package: `in.fcarena.app`

The highest versionCode currently recorded as uploaded to Google Play is 10. Build 11 was prepared previously but was not uploaded, so versionCode 11 remains the final candidate until a Play upload occurs. After any upload, update `apps/android/play-upload-history.json` immediately.

## Final order

1. Complete production-readiness Steps 1–19.
2. Merge the final readiness changes to `main`.
3. Confirm the same final source is deployed to the web/API where applicable.
4. Run:
   `npm run check:final-release`
5. Confirm Android lint/debug/release compilation and the final readiness CI are green.
6. From a clean, current local `main`, use the **existing FC ARENA upload keystore** with:
   `apps/android/build-signed-release.ps1`
7. The signing helper verifies the expected upload-certificate SHA-256 before and after the build and writes artifact metadata.
8. Expected artifact:
   `FC_ARENA_v1.0.9_build11_signed.aab`
9. Record the exact source SHA and AAB SHA-256.
10. Upload that exact AAB to the required Google Play testing track.
11. Install/update through Google Play and perform final physical-device acceptance.
12. Confirm Crashlytics reporting and FCM push delivery/deep links on the final-source build.
13. Review Play pre-launch report and policy declarations before production access/promotion.

## Required physical-device acceptance

- cold launch
- repeated close/open and background/resume
- login/logout and retained session
- Dashboard and navigation
- League/Tournament/Fixtures/Standings/Awards
- profile photo picker/upload
- Android Back behavior
- offline/reconnect path
- notification permission allow/deny
- enable/disable push
- foreground/background push
- safe notification deep link
- old closed-test build -> final build update preserves expected session/preferences
- no fatal crash/ANR during the smoke run

## Crashlytics acceptance

Use only a controlled non-public/test path to generate one diagnostic crash/non-fatal event from the final-source Android build. Reopen the app and confirm the event appears in Firebase Crashlytics. Do not deliberately crash the public production population.

## Version rule

A versionCode that has been uploaded to **any** Play track is consumed and must never be reused. If versionCode 11 is uploaded before the final artifact is produced, stop and move to the next unused code/name instead of overwriting Build 11.

## Signing rule

Do not create a new keystore. Do not rotate the upload key for this release. Never commit or paste keystore passwords, private keys or Firebase Admin credentials.

The final release is not complete merely because an AAB compiles: source/deployment traceability, signer verification, device testing and Play Console review must all match the exact artifact.
