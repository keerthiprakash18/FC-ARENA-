# Push notifications and ranking history

The English UI keeps the existing cream, navy and gold design. Leaderboards save the first observed ranking table each UTC day, separately for each league and competition mode. Movement compares the current table with the most recent earlier saved day. There is no fabricated historical data or backfill; movement starts after a later day's visit. Snapshots contain the top 100 players, matching the ranking endpoint.

Android 1.0.8 (version code 10) adds opt-in Firebase phone notifications and safe competition deep links. Settings show availability honestly when Firebase is not configured. Delivery is bound to an active login session, follows refresh-session rotation and stops for revoked sessions. Existing in-app notifications continue without Firebase. Recipient-scoped deduplication also fixes shared match updates being available to only the first recipient.

## Required production setup

The current Android candidate is version 1.0.18 / code 20. The Windows signing helper reads `version.properties`. Run `powershell -ExecutionPolicy Bypass -File .\apps\android\build-signed-release.ps1` and enter the existing upload keystore path, alias and passwords locally. The output is `apps/android/release/FC_ARENA_v1.0.18_build20_signed.aab`. Never send signing passwords or the private keystore through chat.

1. Android client configuration for the owner-managed Firebase project `fc-arena-102a1`, package `in.fcarena.app`, is included at `apps/android/app/google-services.json`. Fresh checkouts and CI include that public client configuration automatically. The optional repository secret `FIREBASE_ANDROID_CONFIG_BASE64` can override it; update or remove an older override before building. This file contains client identifiers, not an Admin SDK service-account private key. Versions built against the previous project need a native app update.
2. Enable Firebase Cloud Messaging for that project. Put a service account credential with messaging permission in the backend's server-only environment variable `FIREBASE_ADMIN_CREDENTIALS_JSON`, and set `PUSH_ENABLED=true`. Restart the backend with the updated environment. Never commit or paste the private service-account key into chat or the Android configuration.
3. Build a signed Android release with the existing signing process and upload version code 20 to the existing Play release track, after checking its current highest version code. CI's unsigned validation AAB is not a publishable signed release.
4. On a physical device, install the new release, sign in, open Notifications and enable phone notifications. Grant the Android permission, then verify a fresh competition update with the app closed, its deep link, disable, logout, and token refresh.

The new project's backend sender was enabled on 7 November 2026 and validated without sending to a real device. Its credentials are stored in root-only server configuration. Play upload and physical-device delivery still require verification. Existing installed Android versions still receive the web improvements but need the native update for the new Firebase project. A rotated Firebase token is registered on the next app page load. Delivery retries transient failures up to five times and removes invalid tokens; it is best effort and may be delayed by Android battery settings. Queued messages already handed to Firebase may arrive shortly after logout.

## Automatic pending fixture reminders

The backend independently checks for pending fixtures at 10:00 and 19:00 Asia/Kolkata, without requiring app visits or per-match times. An unscheduled stage's Day 1 is its tournament start date, falling back to fixture publication; later matchdays use consecutive India calendar days. An explicit fixture date takes precedence. Today and overdue fixtures qualify; future days do not. Playoff leg numbers are not calendar-day offsets. Legacy playoffs inherit tournament publication and use their fixture creation date when a per-fixture publication timestamp is absent.

Each player gets at most one grouped reminder per slot, across tournaments. Database uniqueness prevents duplicates across restarts and concurrent workers. A fifteen-minute recovery window allows brief restarts without replaying old slots later. Set `FIXTURE_DAY_REMINDERS_ENABLED=false` to disable the worker; it otherwise runs independently of `PUSH_ENABLED`.

Results awaiting verification or already confirmed suppress reminders for both sides. Rejected submissions may be reminded again. Cancelled/postponed/completed matches, unpublished/inactive competitions, unresolved or withdrawn entries, nonmembers, inactive accounts and opted-out players are excluded. A UCL return leg requires a verified first leg. Queued phone reminders recheck eligibility and their direct match link before delivery and expire after the slot window. In-app reminders remain as notification history.

The backend migration creates ranking snapshots, devices and delivery records and scopes historical dedupe keys to the recipient. API builds generate the Prisma client before compiling.
