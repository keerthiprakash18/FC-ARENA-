# Android update notices

The app shows a small, dismissible “Update available” card with an “Update app” link to the existing FC Arena Play listing. “Later” snoozes that version for twelve hours; a newer release is eligible immediately. Normal website/PWA users receive no Android update check or notice.

Native build 20 now includes Google's Play In-App Update availability library, `com.google.android.play:app-update:2.1.0`. It checks at foreground/resume and every fifteen minutes while active. Only a higher version available to that account/device/track is announced. Availability is passed to the trusted FC Arena WebView through `window.__fcAndroidUpdate` and `fc-arena:android-update`. This successful device-specific result takes precedence over a global server announcement, including staged-rollout exclusions. Offline, sideloaded or unsupported devices continue using the app; a failed optional lookup does not interrupt startup or matches. The Update button opens Play Store; it does not silently install or force an update.

Older installed versions expose their version name in the existing `FC-Arena-Android/<version>` user agent. Their web notice reads `/api/mobile/android/version?versionName=...`, which compares semantic release versions and selects only published production announcements whose publication time has arrived. Existing numeric `versionCode` clients retain their update/force-policy contract. The response is not cached. Checks are throttled, pause offline/background and recover after focus/reconnection. Nothing is advertised when no production announcement exists.

## First publication of build 20

The owner confirmed on 7 November 2026 that build 20 had not been uploaded/released. Its AAB was therefore rebuilt at the same version code with this feature. Use the latest `FC_ARENA_v1.0.18_build20_signed.aab`; earlier downloads of build 20 lack this update detector. No production announcement or Play release was published by this change.

After the signed AAB is genuinely available in the intended Play production track, publish its matching announcement for older clients using the existing super-admin release registry: create `/api/admin/ops/android/releases`, mark the returned record `READY` through PATCH, then POST `/api/admin/ops/android/releases/<id>/publish`. The create body is prepared locally at `.cache/app-update-notice/release-candidate.json`. This first announcement makes users of older native versions aware of build 20. New versions containing the Play detector discover subsequent eligible releases automatically; the registry remains a fallback. Never publish the server announcement merely because an AAB built successfully or entered review.

## Verification

The API's version-name/code policy has unit and real PostgreSQL HTTP coverage for old/current/newer clients, malformed queries, draft/closed/future exclusions and no-store responses. Browser scenarios cover 320/390/1280px, light/dark, update links, snooze, new releases, native events and per-device rollout eligibility. Native tests use Google's `FakeAppUpdateManager` for availability, equal-version exclusion and throttling. Real Play delivery/availability must still be verified using a Play-installed version and a higher version made available to that account; a sideloaded APK does not establish that boundary.

## Web improvements inside an already installed app

Native 1.0.18 loads the hosted frontend. A warm WebView can retain its existing document after a web deployment. The Android-only web release notice checks the frontend identity at `/web-release` on startup, resume/reconnection and periodically while visible. A different valid deployed release offers Reload latest and Later. It never reloads an active form automatically, bypasses no server permissions, and does not claim a new APK is published. Explicit reload preserves cookies and settings, retires only FC Arena service workers/caches, and navigates to the same route with a fresh release query parameter. An already open document predating this watcher needs one fresh document navigation to receive it.

The account-scoped league choice now persists in local storage across a new WebView session. Existing session choices migrate on read. Active tournament cards show the league and tournament code plus registered, approved and pending totals, so identically named tournaments remain distinguishable.
