# Step 13 — Push Notification Finalization

Status: code complete; backend/web acceptance is CI-tested. Final physical-device/Firebase delivery confirmation remains part of the Step 20 release gate because the final Android AAB is intentionally not built yet.

## End-to-end controls

- Android notifications are explicit opt-in.
- Android 13+ runtime permission is requested only when the user enables notifications.
- Permission denial does not block FC ARENA.
- FCM auto-init is disabled until opt-in.
- FCM token is published on page load/resume, covering token rotation after app update/backgrounding.
- Backend registration is tied to a live authenticated refresh session.
- A refreshed token is prioritized for the next worker cycle.
- Maximum registered devices are bounded.
- Logout/revoked/expired sessions stop delivery.
- Disable now removes every backend token bound to the current authenticated session, even if Android cannot currently return the token.
- Stale/revoked devices are pruned.
- Invalid/unregistered FCM tokens are removed.
- Delivery uses dedupe rows, leases and bounded retries.
- Notification hrefs are restricted to safe FC ARENA relative paths.
- Push remains optional; in-app Notifications continue to work without permission.

## Deferred final gate

On the one final signed Android build: grant/deny permission, enable/disable, FCM token refresh, foreground/background delivery and safe deep-link tap will be physically verified.
