# Build 12 smoothness audit

Base: c853b93a389c758846e786f06905a0a6fe46bae1. No version bump, AAB, production data changes or credential changes.

## Verified work

- The shell notification badge fetched up to 100 complete notifications to display one number. Added optional `GET /notifications?summary=true`: synchronization still runs, then one user-scoped count query, with no inbox row query. Existing `/notifications` retains its contract. An older backend ignores the additional query parameter and returns the compatible full response.
- Concurrent badge/inbox/push synchronization can repeat the same database work. In-flight synchronization now shares one promise per user and releases both successful and failed work. Different users remain isolated. There is no persistent server-side count cache.
- Summary and full inbox keep separate 10-second client caches; read mutations, login and logout invalidate both. Simultaneous requests for the same representation coalesce.
- Android Activity did not forward pause/resume to its WebView. It now forwards both, without reloading the page, clearing cookies or pausing process-wide JavaScript timers. Photo-picker/auth callbacks can complete normally.
- Existing HTTP cache, DOM storage, native reduced motion CSS, hardware rendering default and crash-only software rendering fallback are retained. Dashboard reads already run in parallel; no speculative rewrite was made.

## Measurement

Real NotificationsService with mocked synchronization/database and a fixed synthetic 100-record inbox:

| Measure | Before | After |
|---|---:|---:|
| Serialized badge response | 12,152 bytes | 54 bytes |
| Queries after synchronization | 2 | 1 |
| Inbox records materialized for badge | 100 | 0 |
| Concurrent same-user sync invocations | 2 | 1 |

This is a deterministic query/payload budget, not a production latency or FPS measurement. Synchronization queries still exist. Backend deployment is required for payload/query savings.

## Verification

- API production build passes with a synthetic localhost DATABASE_URL (generation only; no database connection).
- API unit tests: 156 pass, including four new performance/isolation/failure tests.
- API and web lint pass; existing warnings remain.
- Web production build passes. Restricted sandbox Turbopack stalled; the permitted build outside the sandbox completed.
- Root client regression tests pass (notification caches, update compatibility, deployment ID, resilience).
- Local API E2E could not run: PostgreSQL/Redis are not installed/configured. Existing Security Hardening CI runs these with isolated services.
- Browser smoke setup blocked: Playwright Chromium download returned an invalid/truncated archive.
- No local Android SDK/emulator. Existing Android CI runs lintRelease, debug APK, release Java/resources compilation without AAB, and Android API 33/34/35/36 launch/navigation/scroll smoke.

## Acceptance before release

All CI gates must pass before merge. On the same physical tester phone, compare the current installed build and a future permitted build: cold launch, dashboard scroll, league switching, notification page/read-all, five HOME/resume cycles, photo picker cancel/upload, back navigation and logout/login. Use a test account and fixed network/data. Capture Android frame timing/Perfetto and time-to-dashboard; target no ANR, no sustained dropped-frame bursts, and a 16.7ms frame budget on a 60Hz screen. Confirm session retention. No claim of measured physical-device smoothness until that comparison is recorded.
