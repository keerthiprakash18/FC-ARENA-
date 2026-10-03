# Step 20 — Final Production Gate & Android Artifact

Status: FINAL SOURCE GATE IMPLEMENTED. The signed AAB and physical-device/Firebase checks occur only after this branch is merged and production deployment is confirmed.

Last reviewed: 3 October 2026

## Frozen candidate

- Package: `in.fcarena.app`
- versionCode: 11
- versionName: 1.0.9
- Highest known Play-uploaded versionCode: 10
- Upload key: existing FC ARENA upload key only

`scripts/final-release-gate.mjs` blocks the candidate when the version is not strictly newer than recorded Play upload history, package/SDK policy changes, legal/Data Safety controls disappear, rollback prerequisites are missing, or the signing helper loses traceability controls.

## Source gate

Before signed build:

- Steps 1–19 repository controls complete.
- API build/lint/unit/E2E green.
- Web lint/build green.
- Security/secret gates green.
- Android lint + debug + release compilation green.
- targetSdk/compileSdk 36+.
- No unreviewed sensitive permission, ads SDK or AD_ID permission.
- Privacy, account deletion, UGC moderation and Data Safety gates green.
- Version candidate is unused in Play.
- Production web/API deployment corresponds to final source where applicable.
- Database/Redis monitoring, backups and isolated restore verification remain healthy.
- Rollback/DR runbook exists.

## Signed artifact gate

The final signed AAB must be produced from clean current `main` by `apps/android/build-signed-release.ps1`.

Required artifact evidence:

- source Git SHA
- package
- versionCode/versionName
- upload certificate SHA-256
- AAB SHA-256
- exact artifact filename

Expected candidate filename while versionCode 11 is unused:

`FC_ARENA_v1.0.9_build11_signed.aab`

## Post-build acceptance

Before Play production promotion, verify on a physical device using the Play testing path:

- update from the currently distributed test build
- cold/repeat launch and background/resume
- auth/session retention/logout
- core League/Tournament/Fixture/Result/Standings/Awards flows
- network loss/recovery
- file/profile upload
- push permission allow/deny, enable/disable, token binding, foreground/background delivery and safe deep links
- one controlled final-source Crashlytics diagnostic and Firebase dashboard receipt
- no observed fatal crash/ANR in the acceptance run

## External Play Console gate

Repository automation cannot truthfully mark Play Console fields as submitted. Before production access/promotion, the operator must confirm:

- required closed-test eligibility is shown in Play Console;
- Privacy Policy and account-deletion URLs are accepted;
- Data Safety is copied from Step 16 and matches the exact artifact;
- App Access reviewer credentials work;
- target audience, content rating and ads declaration are accurate;
- store listing assets/text match the final app;
- pre-launch report has no unresolved release blocker.

## Decision language

Use **PASS** only for gates actually verified. A remaining external/device action is reported as pending, not silently treated as complete. Do not claim “100% secure”, “zero bugs” or guaranteed production capacity.

Step 20 closes only when the signed artifact and final device/Play checks refer to the same frozen source.
