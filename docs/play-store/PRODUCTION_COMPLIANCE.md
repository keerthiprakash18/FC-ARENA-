# FC ARENA — Google Play Production Compliance Gate

Last reviewed: 2 October 2026

This file is the release gate for the FC ARENA Android app (`in.fcarena.app`).
It is intentionally stricter than the minimum build requirements: if a new feature
changes data collection, permissions, payments, ads, AI behavior, or account handling,
the Play Console declarations and this document must be reviewed before release.

## 1. Production-access prerequisites

For a new personal Play developer account created after 13 November 2023:

- Closed testing must have at least 12 opted-in testers continuously for 14 days.
- Keep more than 12 invited/active testers where practical so one tester leaving does
  not drop the account below the minimum.
- Testers must meaningfully use the product rather than only install/open it.
- Keep evidence of feedback and the fixes made from that feedback.
- Do not apply for production until the closed-test requirement is actually satisfied
  in Play Console.

FC ARENA closed-test flows to exercise:

1. Install/update from the Play closed-test link.
2. Register/login and retain session after restart.
3. Create or update profile.
4. Join a League with a valid League code.
5. Register for or open a Tournament.
6. Open a fixture / Match Room.
7. Mark Ready and verify the opponent state.
8. Submit a result or proof where allowed.
9. Verify result confirmation/rejection/dispute behavior.
10. Verify standings/statistics/awards update correctly.
11. Open notifications and deep links.
12. Exercise Discover/public player profile without exposing private data.
13. Verify Fair Play: player sees own event details/appeal rights; other members see summary only.
14. Request account deletion from Settings and verify the public deletion page.
15. Repeat on Wi-Fi/mobile data and after background/resume.

Record tester feedback in `docs/play-store/CLOSED_TEST_EVIDENCE.md`.

## 2. Android technical gate

Current intended baseline:

- Package: `in.fcarena.app`
- Target SDK: 36+
- Minimum SDK: 24
- HTTPS only
- Firebase Analytics collection disabled
- Android backup disabled
- Notification permission requested only where needed
- No location, contacts, SMS, microphone, camera, phone-state, or broad-storage
  permission without a fresh compliance review

Run:

`node scripts/check-play-store-compliance.mjs`

A failure blocks the Play release until reviewed.

## 3. Privacy / Data Safety consistency

Public Privacy Policy:
`https://fcarena.in/privacy`

Public account-deletion page:
`https://fcarena.in/account-deletion`

The Data Safety form must be kept consistent with actual production behavior.
Current code can process the following categories:

| Data category | FC ARENA use | Notes to verify in Play Console |
| --- | --- | --- |
| Name / display identity | Account + competition identity | Full name and in-game name |
| Email address | Account login, recovery, deletion verification | Required account data |
| Phone number | Optional account/profile field where enabled | Do not mark required if optional |
| User IDs | FC Arena player/account identifiers | Includes internal account/player IDs |
| Photos / images | Optional profile photos and match/result evidence | Cloudinary can process uploaded images |
| App activity / competition content | Leagues, tournaments, fixtures, results, disputes, awards | Core app functionality |
| User-generated / moderation content | Names, team/tournament content, reports/disputes, Fair Play event reasons and appeals | Safety/reporting controls and Fair Play appeal/revocation flow exist |
| Device or other identifiers | Firebase Cloud Messaging registration token | Used for Android push delivery |
| Diagnostics / security records | Server/security logs and rate-limit identifiers | Verify retention/collection wording before submission |

Current production service providers disclosed in the Privacy Policy include hosting
providers, Brevo, Cloudinary, and Google Firebase Cloud Messaging. If the optional AI
provider is enabled in production, verify the exact provider and Data Safety/privacy
disclosures before Play submission.

Do not add advertising SDKs, analytics SDKs, payment SDKs, location collection, contact
collection, or other sensitive data processing without updating the Privacy Policy and
Data Safety form first.

## 4. Account deletion

Because FC ARENA supports account creation:

- Signed-in users must have a clear path from Settings to deletion.
- A public web deletion-request path must remain available without requiring login.
- Ownership may be verified before deletion.
- Personal account/profile/session data must be deleted or anonymized as documented.
- Competition/security records retained for integrity must not be usable to recreate
  the deleted account.

Before production submission, perform one real deletion-request test using a disposable
test account and record the result.

## 5. App Access for Google review

FC ARENA requires authentication for major functionality. Play Console App Access must
therefore include working reviewer credentials and exact navigation steps.

Reviewer account requirements:

- Active account
- Email already verified if verification is enabled
- Not dependent on OTP delivery that Google cannot access
- Member of a League containing representative fixtures/tournaments
- Has access to a Match Room and read-only awards/discover screens
- Must not be a personal developer/admin account

Never commit reviewer credentials to GitHub.

Suggested Play Console instructions:

1. Launch FC ARENA.
2. Tap Login.
3. Enter the reviewer email/username and password supplied in Play Console.
4. Open League → Tournament → Fixtures → Match Room.
5. Open Awards and Discover from the app navigation.
6. Settings → Delete Account & Data shows the account-deletion route.

Verify these steps against the actual release build before submission.

## 6. Store listing / content declarations

Before production access/application:

- Privacy policy URL resolves publicly over HTTPS.
- Account deletion URL resolves publicly over HTTPS.
- App name, screenshots, short/full description match the actual app.
- Content rating questionnaire is completed accurately.
- Target audience/age declarations match the intended esports community.
- Ads declaration is No unless advertising is actually added.
- Data Safety answers match the release build.
- App Access reviewer credentials work.
- No copyrighted game logos/assets are introduced without permission.
- No real-money betting/gambling language or mechanics are introduced.

## 7. Release quality gate

Before uploading the candidate AAB:

- Web production build green.
- API build/lint/tests green.
- Android lint green.
- Signed release AAB built with the existing upload key.
- AAB versionCode is higher than every previous Play upload.
- Signer SHA-256 verified against the known upload certificate.
- Internal test install/update passes.
- Closed-test install/update passes.
- Play pre-launch report reviewed for crashes, ANRs, security warnings and compatibility.
- No unresolved P0/P1 bugs.
- Release notes match the build.

## 8. Change-control rule

Any future feature touching one of these areas is a mandatory Play compliance review:

- Permissions
- New SDKs
- Ads
- Payments/subscriptions
- AI providers
- Location
- Contacts
- Camera/microphone
- Files/media
- Children/target audience
- User-generated content or moderation
- Account creation/deletion
- Public profile/privacy behavior

Do not merge such a feature into a Play release only because CI is green.
