# Step 12 — Failure States and Resilience

Status: implementation ready; accepted when web/API tests and the dedicated resilience tests are green.

## Controls

- API client timeout: 15 seconds.
- Automatic retry is limited to idempotent GET/HEAD requests.
- One retry is allowed for network failure, timeout, HTTP 502, 503 or 504.
- Mutations are never automatically replayed after ambiguous failures.
- Authenticated GET requests can refresh an expired access token once after an explicit 401.
- Uploads retry only after an explicit HTTP 401; network/timeout/5xx upload failures are never replayed.
- Route-level and global Next.js error boundaries provide a retry path without resubmitting user actions.
- Shared `FcErrorState` supports a visible retry action.
- Notifications, Dashboard and Fixtures expose recovery/partial-failure behavior.
- Android already has offline startup, WebView renderer recovery and a native fallback.

## User-visible failure categories

Network unavailable, request timeout, temporary backend 5xx, session expiry, upload failure, empty data and partial Fixture fetches receive recoverable UI rather than a blank screen.

The resilience test explicitly verifies that a failed POST is sent only once.
