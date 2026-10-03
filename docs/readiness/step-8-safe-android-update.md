# Step 8 — Safe Android update path

Date: 2026-10-03. Branch: readiness/safe-update-performance.
Base: bb4f4210df8b8b14df82e11cbc509322ed6c1238 (Step 5–7 draft PR #93).

Implementation and local validation are complete for the changes below. Actual previous-Play-build → future-final-build acceptance remains pending. This is not a claim that a Play update was installed or tested. No signed AAB, Android version bump, production-data change or storage reset was performed.

## Audit, risks and expected behavior

| Area | Finding / change / expected behavior |
| --- | --- |
| SharedPreferences | Keep `fc_arena_android` and `fc_push`, including push `enabled`. No migration of user preferences or blanket clear. Add `installed_version_code` only as internal bookkeeping. |
| Cookies/WebView session | CookieManager, WebView profile and HTTPS origin stay unchanged. HTTP cache remains LOAD_DEFAULT. No clearCache, clearData, removeAllCookies or localStorage.clear is introduced. The in-memory access token can disappear on process death; the persisted HttpOnly refresh cookie restores the session when valid. Expired/revoked sessions legitimately require login. |
| Push consent | The existing preference and OS notification permission remain authoritative. Update does not opt users in or change denial to consent. |
| FCM token lifecycle | Token may remain stable or change. Existing page-finished publication remains; onResume now fetches/publishes the current token through the same bridge. Frontend retries binding on login, connectivity restoration and focus. A different token arriving during a pending registration is bound after that request finishes. No FCM token or web auth credential is persisted in a new native store. Background delivery after rotation can still wait until the next authenticated foreground/page load; no background-auth mechanism was added. |
| HTTP cache | Retained across updates. Content-hashed Next assets remain cacheable; no startup cache purge. |
| Startup guard | A crash marker from a previous build could force the first new-build launch into fallback. On a newly observed version code, reset only startup_guard and version_check_at, then record the code. For subsequent launches of that same build the crash-loop guard behaves as before. First install of this bookkeeping treats a missing version marker as a new build. |
| App-data migration | No native database schema or existing key format changes. Backend/API payloads and auth routes are unchanged. |
| Deep links | Same package, host, Activity and intent filters. Existing allowlisting is retained. Verify cold/warm and push deep links on device. |
| Profile picker | Existing picker and upload endpoints remain. Previous Step 7 permission-failure/renderer recovery fixes are inherited. Update does not preserve an unfinished external picker transaction across process replacement; user may need to reopen the picker. |
| Logout/login | Cookies are cleared only by the existing explicit logout flow. Signing in emits a frontend event so an existing native token can bind again without waiting for a page reload. Logout/reset isolation of pending requests is regression-tested. |
| Reinstall vs update | Treat uninstall/reinstall or Clear storage as a fresh install; do not promise login/settings retention. allowBackup=false remains. An in-place update must retain application ID and compatible Play signing identity. The debug package is different and cannot validate upgrading the production Play package. |
| Service worker/PWA | Native cleanup previously marked success before work and removed every worker. New helper unregisters only the same-origin /sw.js, removes only fc-arena-* CacheStorage, and marks completion after success. Failure retries later; cookies/settings are untouched. PWA activation previously deleted unrelated origin caches: now deletes only older fc-arena-* caches. Reads use the current worker cache. Worker cache becomes v8 (not an Android version change). |
| Frontend mismatch | /sw.js has explicit no-store/revalidation headers. Next deploymentId uses NEXT_DEPLOYMENT_ID or VERCEL_GIT_COMMIT_SHA for framework version-skew handling. Self-hosted deployments must set one stable ID per build on all instances, and retain old static assets through rollout. This does not route traffic between old/new servers or preserve unsaved form input during a necessary reload. |
| Old wrapper rollout | No new required bridge method, native payload field, auth cookie or API contract. Old wrappers can use the new frontend. They retain their previous resume behavior until updated. Keep API endpoints/response fields backward compatible during rollout. |

## Automated verification

`node tests/update-performance.test.cjs` executes ten behavioral checks, including failed cleanup retry, scoped PWA cache deletion, worker ownership, token-change registration, login rebinding, pending-read account isolation and mutation isolation. Existing notification cache regression also passes. Android lintRelease, debug APK and release Java compilation validate native changes; web/API builds, lint, unit/e2e and Chromium smoke validate the integrated checkout. These do not simulate installation or Android lifecycle.

## Required final physical-device upgrade acceptance

Run on Android 13, 14, 15 and 16, including at least one actual existing Play tester. Use the future approved Play closed-testing release when it exists; do not build a signed AAB just for this checklist.

1. Record old Play version/package and whether signed in. Use a disposable staging/test account. Record theme, primary/secondary league, push opt-in/out and OS notification permission. Never copy cookies, tokens or secret values into evidence.
2. With the old build, use dashboard, fixtures, standings, awards, profile and a valid deep link. For one case enable push; for another keep push disabled. Background the app with a valid session.
3. Update through Play **without uninstalling or clearing storage**. Confirm the same in.fcarena.app identity and Play signing lineage; a debug APK is not a substitute.
4. Cold-launch and resume. Expect valid-session restoration without unnecessary login, retained settings and unchanged push consent. Expired/revoked-cookie case should request login normally. Offline launch should show a recoverable state without deleting storage.
5. Verify both leagues/upcoming matches; profile photo picker including cancel; upload; deep links from browser; notification deep link from cold and warm states; foreground FCM rebinding; logout then login to the same and a different test account.
6. Simulate a previous-build startup crash marker in a **debug/staging** installation only, then update: new build should attempt normal startup once. A repeated crash on the same new build must still trigger fallback.
7. Keep an old frontend document open across a frontend deploy. Navigate after rollout: confirm fresh assets or version-skew reload, retained cookies/settings, no reload loop, no stale API response. Repeat with legacy PWA caches, worker cleanup failure, offline recovery and a long session.
8. Confirm push-disabled and permission-denied users remain disabled. Exercise a changed FCM token while registration is delayed; confirm a registration for the newest token, without logging the token itself. Confirm another account does not receive the former user's private notification data.
9. Separately test uninstall/reinstall on a disposable installation: fresh login/consent is expected. Never use uninstall to test update retention.
10. Record device/API, old/new version, update source, session result, preference result, push result, links/picker and screenshots. Any unexpected data loss blocks release.

For local debug-only rehearsal, build old/new debug APKs with the same local debug signing identity and use `adb install -r` for the second install; do not uninstall between them. Do not inspect or export a real tester's cookie database. Same-version debug reinstall can test data retention but does not replace Play's higher-version update path.

## Remaining risks

- The future final build and old Play artifact were not supplied; actual signing/update compatibility is unverified.
- Android API 33–36 physical/emulator update runs are still outstanding.
- Session expiration/revocation is a server policy, not storage loss; existing access JWT logout window from PR #93 remains.
- Step 5–7 dependency/security blockers still apply. This branch is stacked on that unmerged work.
- Self-hosted rollout must configure NEXT_DEPLOYMENT_ID; missing deployment IDs do not enable new skew protection.

References: https://developer.android.com/google/play/app-updates ; https://developer.android.com/studio/publish/app-signing ; https://firebase.google.com/docs/cloud-messaging/android/get-started . Next behavior was checked against the installed Next 16.3.6 deploymentId and self-hosting documentation.
