# Step 16 — Privacy & Google Play Data Safety Audit

Status: CODE/DOCUMENTATION COMPLETE. Play Console answers must be copied from this worksheet and rechecked against the exact final build before submission.

Last reviewed: 3 October 2026
Package: `in.fcarena.app`

## Scope reviewed

The audit covers the Android wrapper, FC ARENA web app loaded in the WebView, API/database persistence, Firebase Cloud Messaging, Firebase Crashlytics, Brevo transactional email, Cloudinary image storage, Vercel/web hosting, backend infrastructure, moderation/reporting, account deletion and the optional AI assistant.

Google Play treats user data collected through a WebView controlled by the app as app collection. The Data Safety declaration therefore covers the FC ARENA web experience as well as native Android SDK behavior.

## Data Safety worksheet

| Google Play data type | Collected? | Shared?* | Required / optional | Primary purpose | FC ARENA examples |
| --- | --- | --- | --- | --- | --- |
| Personal info — Name | Yes | No* | Required account/display data | Account management, app functionality | Full name, In-Game Name |
| Personal info — Email address | Yes | No* | Required | Account management, developer communications, security | Login/recovery/deletion verification, Brevo transactional email |
| Personal info — Phone number | Yes when supplied | No* | Optional | Account management | Optional phone number |
| Personal info — User IDs | Yes | No* | Required/core | Account management, app functionality | Internal account ID, player code, optional game UID |
| Photos and videos — Photos | Yes when uploaded | No* | Optional | App functionality, fraud/security | Profile photo, result/evidence images stored through Cloudinary |
| App activity — App interactions | Yes | No* | Core | App functionality, security | League/Tournament participation, fixtures, results, standings, awards, notifications |
| App activity — Other user-generated content | Yes | No* | Feature dependent | App functionality, moderation, security | Team/Tournament names, reports, disputes, Fair Play reasons/evidence/appeals |
| App info and performance — Crash logs | Yes on Android production diagnostics | No* | Automatic when production Crashlytics is enabled | Reliability analytics / app functionality | Crash stack traces and crash context through Firebase Crashlytics |
| App info and performance — Diagnostics | Yes | No* | Automatic where applicable | Reliability, security | App version, OS/device runtime diagnostics, server/service health metadata |
| Device or other IDs | Yes | No* | Optional for push; security processing otherwise | App functionality, fraud/security | FCM registration token, request/security identifiers and ordinary server security logs |

* "Shared" in the Google Play Data Safety form has defined exceptions, including qualifying service-provider processing on the developer's behalf. FC ARENA currently uses providers as processors to operate the service. Before submission, confirm the current contractual/data-use terms for each provider and only mark a data type as not shared when the Google Play service-provider exception is actually satisfied.

## Data not intentionally collected by the Android app

The current Android manifest does not request location, contacts, SMS, microphone, camera, phone-state, broad media/storage, or advertising-ID permissions. Firebase Analytics collection is disabled. FC ARENA currently has no advertising SDK and does not use targeted advertising.

The app can still receive user-selected files through the system picker/WebView without broad storage permission; uploaded files must be declared under the applicable data type because they leave the device.

## Providers and processing

- **Vercel / web delivery** — serves the FC ARENA web application and may process ordinary request/network logs.
- **Backend hosting / PostgreSQL / Redis infrastructure** — processes account, competition, moderation, session and security data required for FC ARENA.
- **Brevo** — receives the destination email address and transactional-email content needed for password recovery/verification flows where enabled.
- **Cloudinary** — processes optional uploaded profile and competition/evidence images.
- **Google Firebase Cloud Messaging** — processes FCM registration tokens and push-delivery metadata when the user opts into notifications.
- **Google Firebase Crashlytics** — processes crash/diagnostic information for production reliability monitoring.
- **Optional AI provider** — must remain disabled for the release unless the exact provider and its data handling are reviewed and the Privacy Policy/Data Safety form are updated to match production behavior.

## Security and deletion answers

- Data in transit: FC ARENA production endpoints are HTTPS-only; Android cleartext traffic is disabled.
- Account creation: Yes.
- In-app deletion path: Yes — Settings / Delete Account & Data.
- External deletion resource: Yes — `https://fcarena.in/account-deletion`.
- Deletion implementation: authenticated deletion removes/revokes active auth and push data and anonymizes personal identity while retaining only de-identified competition/security records required for integrity.
- Retention: documented in the Privacy Policy. Retained de-identified records must not recreate the deleted identity.

## Consistency checks before Play submission

1. Privacy Policy URL loads publicly over HTTPS and is not a PDF.
2. Account deletion URL loads publicly without login.
3. Privacy Policy names FC ARENA, explains collected data, providers, retention/deletion, security, Crashlytics and FCM.
4. Play Data Safety answers match the exact build and all SDKs currently distributed.
5. If a new SDK, ad system, payment flow, AI provider, permission or sensitive-data feature is enabled, stop the release and redo this audit.
6. Verify Firebase SDK data practices in the current Google Play SDK Index / provider documentation before submitting.
7. Do not describe Firebase Crashlytics as Google Analytics; Analytics collection remains disabled, while Crashlytics diagnostics still require disclosure.

## Release decision

Step 16 is complete at repository level. Play Console is an external declaration surface and must be filled from this worksheet after the final release artifact is frozen. No source change may add a new collection/sharing behavior between this audit and the final AAB without reopening Step 16.
