# FC ARENA — Google Play Data Safety source of truth

Last reviewed: 2026-10-02

This document is the engineering checklist for the **exact Android release build** submitted to Google Play. It is not a substitute for the Play Console questionnaire. Re-check this file against the release AAB, enabled backend features, service-provider contracts and current Google Play wording before every production submission.

## Release baseline

- Package: `in.fcarena.app`
- Target SDK: 36
- Android wrapper: FC ARENA-owned WebView for `https://fcarena.in`
- Firebase Analytics: disabled in the current Android build
- Advertising SDK: none in the current Android build
- Location permission: none
- Contacts permission: none
- Broad storage/media permission: none
- Notifications: optional, user-enabled
- Account creation: yes
- Public account-deletion resource: `https://fcarena.in/account-deletion`
- Privacy policy: `https://fcarena.in/privacy`

## Data types to review in Play Console

| Play data category | FC ARENA use | Required / optional | Primary purpose | Notes |
| --- | --- | --- | --- | --- |
| Name | Full name supplied at registration | Required | Account management, app functionality | Stored on FC ARENA backend |
| Email address | Registration, login, password reset, deletion verification | Required | Account management, security, developer communications | Transactional email may be processed by Brevo |
| Phone number | Optional account field | Optional | Account management | Do not mark required |
| User IDs | FC Arena account ID, Player Code, In-Game Name identity | Required for account/competition identity | Account management, app functionality | Public competition identity may be shown to other participants |
| Other personal info | Optional game UID | Optional | Competition identity / verification | Must not be exposed through public Discover or public tournament views |
| Photos | Profile image, match/result evidence screenshot | Optional | App functionality, result verification, disputes | Cloudinary may process hosted images/evidence |
| Other user-generated content | League/Tournament names where user is admin, reports, dispute text, result evidence metadata, optional deletion-request details, reported AI-output text | Depends on feature | App functionality, safety, fraud prevention | Review exact Play Console category wording |
| App activity / other actions | Tournament registrations, fixtures, results, standings-related actions, League War actions, readiness, confirmations, reports | Feature-dependent | App functionality, fraud prevention, competition integrity | Stored as competition records/audit events |
| In-app search history | Discover search query is sent to FC ARENA to return results | Optional / feature-use | App functionality | Current product does not intentionally use it for ads or ad profiling; confirm whether server/access logs retain query strings beyond ephemeral processing |
| Device or other IDs | FCM registration token / Firebase installation identifier after phone notifications are enabled | Optional | App functionality, developer communications | FCM auto-init is disabled by default; user can disable notifications |
| App info | Application version used by Firebase Cloud Messaging | Optional push feature | App functionality | Firebase documentation states FCM collects app version automatically |
| Security identifiers / logs | Session IDs, rate-limit identifiers, request/security logs | Required for secure service operation | Fraud prevention, security, account management | Map to Play categories based on current questionnaire wording |

## Service providers

These are currently used to operate FC ARENA and must stay consistent with the Privacy Policy and Data Safety answers.

- Vercel — frontend/application hosting
- Railway / production VPS infrastructure — backend/application hosting
- Brevo / transactional mail provider — verification/password-reset email delivery
- Cloudinary — profile images and match/result evidence storage/delivery
- Google Firebase Cloud Messaging / Firebase Installations — optional Android push delivery
- Optional configured AI provider — only when FC ARENA AI is enabled and a user invokes the feature

Treat a transfer as “shared” or not according to the current Play Console definition and the actual contract/use. A service provider processing data solely on FC ARENA’s behalf may fall under Google Play’s service-provider exception, but this must be verified for the release configuration.

## Push-notification disclosure

Current Android behavior:

1. Firebase Messaging automatic initialization is disabled in `AndroidManifest.xml`.
2. Firebase Analytics collection is explicitly disabled.
3. FC ARENA initializes Firebase push only when notification support is enabled by the user.
4. FCM supplies an app-instance registration token; FC ARENA sends that token to its backend and associates it with the signed-in user/session for notification delivery.
5. Disabling phone notifications removes the local FCM token and FC ARENA stops using it for future pushes.

## Account deletion

Google Play account-deletion requirements are addressed by:

- in-app path: Settings → Delete Account & Data
- external web path: `/account-deletion`
- backend request endpoint: `POST /api/auth/account-deletion-request`
- Privacy Policy disclosure of data deletion/anonymization and limited retention for competition integrity/security/legal obligations

Operational requirement: a submitted request must actually be verified and completed. Do not treat “request recorded” as the end of the deletion process.

## Before answering the Data Safety form

Verify all of the following against the exact AAB and production configuration:

- no new Android SDK was added
- no permission was added
- no analytics/crash-reporting SDK was enabled
- no advertising SDK was added
- no payment/subscription SDK was added
- no new external API receives user data
- Firebase notification behavior still matches this document
- optional AI provider behavior is accurately disclosed
- AI-output reporting remains available in-app if generative AI is enabled
- current Terms acceptance and UGC moderation controls remain enabled
- search/log retention behavior is known
- Privacy Policy matches the form
- deletion resource is publicly reachable without sign-in

If any item changed, update this document and the Privacy Policy **before** submitting a new Play release.
