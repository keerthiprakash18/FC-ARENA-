# Push notifications and ranking history

The English UI keeps the existing cream, navy and gold design. Leaderboards save the first observed ranking table each UTC day, separately for each league and competition mode. Movement compares the current table with the most recent earlier saved day. There is no fabricated historical data or backfill; movement starts after a later day's visit. Snapshots contain the top 100 players, matching the ranking endpoint.

Android 1.0.8 (version code 10) adds opt-in Firebase phone notifications and safe competition deep links. Settings show availability honestly when Firebase is not configured. Delivery is bound to an active login session, follows refresh-session rotation and stops for revoked sessions. Existing in-app notifications continue without Firebase. Recipient-scoped deduplication also fixes shared match updates being available to only the first recipient.

## Required production setup

1. In the Firebase project, register Android package `in.fcarena.app`. Download its client `google-services.json`. For a local release place it at `apps/android/app/google-services.json`; for CI set repository secret `FIREBASE_ANDROID_CONFIG_BASE64` to the base64 encoding of that client file.
2. Enable Firebase Cloud Messaging for that project. Put a service account credential with messaging permission in the backend's server-only environment variable `FIREBASE_ADMIN_CREDENTIALS_JSON`, and set `PUSH_ENABLED=true`. Restart the backend with the updated environment. Never commit or paste the private service-account key into chat or the Android configuration.
3. Build a signed Android release with the existing signing process and upload version code 10 to the existing Play release track. CI's unsigned validation AAB is not a publishable signed release.
4. On a physical device, install the new release, sign in, open Notifications and enable phone notifications. Grant the Android permission, then verify a fresh competition update with the app closed, its deep link, disable, logout, and token refresh.

Until those account configuration and release steps are complete, phone push is not active. Existing installed Android versions still receive the web improvements but need a native update for push. A rotated Firebase token is registered on the next app page load. Delivery retries transient failures up to five times and removes invalid tokens; it is best effort and may be delayed by Android battery settings. Queued messages already handed to Firebase may arrive shortly after logout.

The backend migration creates ranking snapshots, devices and delivery records and scopes historical dedupe keys to the recipient. API builds generate the Prisma client before compiling.
