# Step 17 — Google Play Final Compliance Audit

Status: REPOSITORY AUDIT COMPLETE. Final Play Console declarations/reviewer credentials remain manual console actions tied to the final artifact.

Last reviewed against Google Play Help/Developer Program Policy: 3 October 2026
Package: `in.fcarena.app`

## Current policy baseline used for this audit

- From 31 August 2026, new Android mobile apps and app updates submitted to Google Play must target Android 16 / API level 36 or higher.
- Apps with account creation must expose account deletion in-app and through an external web resource.
- Every app must keep its Privacy Policy and Data Safety declaration accurate for the actual release.
- Apps with user-generated content require terms/rules, ongoing moderation, in-app reporting of objectionable content and user blocking where applicable.
- New personal developer accounts subject to the production-access test requirement need at least 12 testers continuously opted into a closed test for at least 14 days before applying for production access.

Official references reviewed:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/9876937
- https://support.google.com/googleplay/android-developer/answer/14151465

## Technical audit

| Area | Result | Evidence |
| --- | --- | --- |
| Package name | PASS | `in.fcarena.app` |
| targetSdk | PASS | 36 |
| compileSdk | PASS | 36 |
| minSdk | PASS | 24 |
| Cleartext traffic | PASS | Disabled |
| Broad/sensitive Android permissions | PASS | No location/contacts/SMS/mic/camera/phone-state/broad-storage permissions |
| Notifications | PASS | `POST_NOTIFICATIONS`; opt-in flow |
| Firebase Analytics | PASS | Explicitly disabled |
| Crash diagnostics | PASS | Crashlytics disclosed in Privacy/Data Safety audit |
| Advertising ID | PASS | No AD_ID permission / no current ad SDK |
| Account deletion | PASS | Signed-in deletion + public external deletion resource |
| UGC moderation | PASS | Report/block flows and Super Admin moderation queue with Resolve/Dismiss |
| Terms | PASS | Community-content rules and prohibited-content language are part of the release gate |
| App access | MANUAL CONSOLE ACTION | Provide working non-admin reviewer credentials and exact navigation steps |
| Data Safety | MANUAL CONSOLE ACTION | Copy Step 16 worksheet into Play Console after artifact freeze |
| Content rating | MANUAL CONSOLE ACTION | Complete accurately for current FC ARENA features |
| Target audience | MANUAL CONSOLE ACTION | Select actual intended age groups; do not infer from code |
| Ads declaration | PASS / MANUAL CONFIRMATION | Current app has no ads; Play Console declaration should be No for this build |
| Store listing assets/text | MANUAL CONSOLE ACTION | Must match final product and avoid unlicensed third-party assets |
| Closed-test eligibility | EXTERNAL PLAY STATE | Confirm Play Console shows the required tester/duration eligibility before production-access application |

## UGC / safety release rules

FC ARENA competition names, profile identities, uploaded images/evidence, reports, disputes, Fair Play reasons and appeals can constitute user-generated content. The release therefore requires:

- Terms that prohibit harassment, hate/abuse, sexual/exploitative content, graphic violence, scams/spam, impersonation and illegal content.
- In-app reporting.
- Blocking controls where user-to-user interaction supports them.
- Moderation review and auditable decisions.
- No automatic punishment solely from unverified report volume.
- Appropriate action on content/accounts that violate the Terms.

## Intellectual-property / store-listing rule

FC ARENA must not ship copyrighted game/club artwork, logos or other third-party assets without permission merely because names are used for identification. Store screenshots, feature graphics and promotional text are part of the same review.

## Release blockers

The final Play submission is blocked if any of the following becomes true:

- targetSdk falls below the current required level;
- a sensitive permission or SDK is added without a fresh policy/Data Safety audit;
- account deletion or public deletion URL is unavailable;
- report/block/moderation controls are removed while UGC remains;
- ads/payments/gambling functionality is added without the corresponding policy declarations;
- Privacy Policy and actual SDK/data behavior diverge;
- reviewer credentials do not work;
- Play Console still shows unresolved policy declarations or production-access testing requirements.

Step 17 is complete as a code/policy audit. Play Console fields remain artifact-specific external actions and cannot be truthfully marked submitted until the final artifact and console forms are actually reviewed there.
