# Production readiness steps 5–7: security and Android QA

Status: NOT COMPLETE / NOT APPROVED FOR PRODUCTION MERGE.

Repository: keerthiprakash18/FC-ARENA-
Base commit: 85a55e90c8103a51e33f4081cf7e4cc113476005
Branch: hardening/production-steps-5-7
Audit date: 2026-10-03

No production connections, migrations, resets, credential rotations, keystore reads, Android version changes or AAB creation were performed. Database migrations and concurrent tests ran only against a new local PostgreSQL database with local Redis. The debug APK was for validation only. Changes are intentionally kept off main while blockers remain.

## Verified findings and fixes

| Finding | Change |
| --- | --- |
| Auth quotas used a separate check and increment, allowing concurrent attempts to race | One parameterized PostgreSQL upsert atomically consumes a quota. Login consumes before password work. Database time controls expiration. Concurrent integration test admits exactly 5 of 20 requests. |
| No application-wide quota covered normal/sensitive writes | Global guard uses shared database buckets: 1,200 requests/IP/minute and 300 writes/IP/minute; tighter auth limits remain. Health and OPTIONS are exempt. |
| Email OTP relied on IP quotas and a non-atomic OTP attempts read | Added an atomic normalized-email quota as an additional distributed-attack ceiling. Existing OTP attempt/cooldown checks remain. |
| Access JWT authentication did not check current account status or role | Guard rejects missing/inactive users and replaces stale token roles with the database role. HS256 is explicit. Existing access-token format remains compatible. |
| Logout swallowed database revocation failures | Only invalid/expired token verification is treated as already logged out. Database failures now propagate to a sanitized server error. Refresh claims are checked before session updates. |
| Provider bodies/errors could be logged; logo removal and OCR failures could expose provider details | Removed raw mail-provider error logging and response text. Added a global safe 5xx exception filter; preserved actionable 4xx validation responses. OCR stores a generic failure reason. |
| Multipart MIME could disagree with decoded image bytes | PNG/JPEG/WebP metadata must match MIME for OCR, profile images, league-war proof and tournament logos. Existing size/dimension checks remain. Logo upload uses a constant filename. |
| Credential ignore patterns were incomplete outside Android | Added environment variants, keystores, private key formats, service-account filename conventions and backups. Verified representative paths with git check-ignore. |
| API responses could be cached | Set Cache-Control: no-store. Existing exact-origin CORS, nosniff, frame-denial, referrer policy, permissions policy and production HSTS remain. Rejected origin strings are no longer embedded in errors. |
| Android picker/external intents could throw SecurityException | Catch permission failures as well as missing handlers. |
| A picker callback could outlive a crashed WebView renderer | Drop the obsolete callback during renderer recovery. Existing recovery/fallback remains. |

## Existing controls inspected

- Refresh sessions store token hashes, check user status/expiry, and rotate with a transactional updateMany claim. Password reset revokes refresh sessions. Production refresh cookies are HttpOnly, Secure, SameSite=Strict, scoped to /api/auth.
- AuthorizationService checks current database super-admin role, league assignments and tournament-scoped roles. Added regression tests for cross-league access and team-manager privilege escalation. Existing authorization tests cover normal player denial and authorized officials. This is not exhaustive endpoint-by-endpoint penetration testing.
- Admin operational/destructive methods have explicit super-admin/league-admin assertions. Existing behavior is preserved; no destructive action was executed.
- Global DTO validation strips/rejects unknown fields. Prisma tagged SQL in the limiter is parameterized. Sampled disputes raw SQL passes user inputs through placeholders, not SQL concatenation.
- Image storage uses generated identifiers/controlled paths. Inspected upload calls target fixed Cloudinary URLs. These checks do not constitute a complete SSRF/redirect/path traversal proof across every route and third-party component.
- Production startup uses the normal API start command. Android WebView debugging is gated by BuildConfig.DEBUG, cleartext traffic is disabled, backups are disabled, external schemes are restricted, and Firebase startup already has fallback handling. Server deployment NODE_ENV and proxy topology still require operational verification.

## Secrets audit

Gitleaks 8.30.1 scanned all fetched Git history (1,102 reachable commits; scanner reports 1,079 scanned diff-bearing commits) and the current source. Two initial source/history matches were classified:

1. apps/android/app/google-services.json: public Firebase Android client API key. It is not a private Firebase Admin service-account key.
2. apps/api/README.md: CircleCI badge token identical to the official public Nest typescript-starter README.

Narrow path-and-line allowlists document these exceptions. History and staged-change scans pass after classification. A later whole-directory scan also matched generated Android copies of the same client key and local Next build/cache tokens; these generated, ignored build files are not committed or production credentials.

No confirmed private production secret was found; no manual rotation is indicated by these findings. Automated scans cannot guarantee the absence of every custom secret format. No secret value is included in this report. Public Firebase client configuration should still have the expected application/API restrictions in Firebase/Google Cloud; this was not changed or remotely verified.

## Dependencies

npm audit: 0 critical, 11 high, 3 moderate, 2 low (16 total package findings). Findings can include parent packages affected by the same transitive advisory, so these are not 16 independent exploits.

npm audit --omit=dev: 0 critical, 4 high, 2 moderate. This remains a release blocker. The high entries are @prisma/config, deepmerge-ts, mysql2 and prisma. Runtime exploitability depends on the code path; the application uses PostgreSQL, but affected installed packages still require resolution.

npm audit fix --dry-run proposed zero automatic changes. Reported fixes for several chains involve major downgrades; none were applied. No unused dependency was removed without evidence of safe removal, and the lockfile is unchanged.

Android uses AGP 8.13.2, Gradle 8.13, Java 17, compile/target SDK 36 and Firebase BoM 34.19.0. The resolved releaseRuntimeClasspath was extracted and 80 Maven name/version entries were queried against OSV: no advisories returned. This is a point-in-time known-advisory check, not a guarantee that all components are current or safe. Plugin vulnerabilities, device WebView versions and vendor OS patches need continuing monitoring.

## CI changes

- Existing security CI now fails on high npm vulnerabilities (previously critical only). It is intentionally not green while the reported findings remain.
- New Repository Secrets Audit scans fetched history with redaction and checksum-verified Gitleaks.
- Added weekly Gradle Dependabot updates; existing npm/Actions update configuration remains.
- Android CI now runs lintRelease, assembleDebug, compileReleaseJavaWithJavac and processReleaseResources. Removed unsigned AAB generation/upload. These validate release compilation/resources, not final bundle packaging/signing.
- Existing emulator matrix for API 33, 34, 35 and 36 remains. CI execution results are separate from local results below.

## Validation results

| Check | Result |
| --- | --- |
| API production build (npm run build:api) | PASS |
| API lint | PASS, 4 existing warnings |
| API unit tests | PASS, 146 tests in 25 files |
| API e2e | PASS, 15 tests in 3 files, local PostgreSQL/Redis |
| Atomic concurrent rate-limit test | PASS, exactly 5 admitted / 15 rejected |
| JWT status/role, logout, cross-object authorization, image format and safe-error tests | PASS as part of unit suite |
| Web production build | PASS |
| Web lint | PASS, 0 errors / 161 existing warnings |
| Android lintRelease | PASS, 0 errors / 20 warnings |
| Android assembleDebug | PASS |
| Release Java compilation and resources | PASS, no AAB generated |
| Android version verification | PASS, existing 1.0.9 / code 11 unchanged |
| Play compliance script | PASS |
| Existing smoke harness, Chromium fallback | PASS, 48 page/viewport checks across 6 profiles with mocked API |
| Notification-cache node test | PASS, 1 test |
| Secret history / staged diff scans | PASS after public/template classification |
| Android Maven OSV query | 80 results, no advisories returned |
| npm high-severity gate | FAIL: unresolved high findings |
| git diff whitespace check | PASS |

## Android runtime coverage and required device checks

No Android emulator or physical device was run locally: the environment has no /dev/kvm. Android 13/API33, 14/API34, 15/API35 and 16/API36 are CI targets, not locally verified devices. Chromium fallback tests do not simulate Android lifecycle or platform versions.

Before approval, run the matrix and physical-device checks for cold launch; repeated open/close; background/resume; process recreation; back navigation; IME; bars/cutouts; portrait/large-screen rotation behavior; login/session retention; photo picker; external/deep links; notification deep links; offline startup/connection loss; renderer crash; absent/outdated WebView; memory pressure; Firebase/push startup; and release-only behavior. In particular, exercise picker cancellation after renderer loss and SecurityException fallback using restricted intent handlers.

## Remaining risks and manual actions

1. Resolve the reported high dependency chains with tested compatible updates or an explicitly reviewed remediation plan. Do not force downgrade Nest/Prisma/Next to satisfy the scanner.
2. Run GitHub CI and Android 13–16 runtime/device checks. No production merge is authorized by these local results alone.
3. Perform a full endpoint-by-endpoint object authorization and destructive-action review with representative super-admin, league-admin, team-admin and player accounts on staging. Current tests are targeted, not exhaustive.
4. Access JWTs still have the existing 15-minute lifetime. Logout/password reset revoke refresh sessions; already issued access tokens for an active account remain valid until expiry. Immediate per-session access revocation needs a backward-compatible session design that handles refresh rotation and concurrent tabs/devices.
5. Confirm reverse-proxy trust hops and that direct backend access cannot spoof client IP. Load-test the new database-backed quotas and tune shared-NAT ceilings. Plan retention/cleanup for rate-limit rows without deleting production data during this work.
6. Verify production CORS/environment configuration and debug settings on the actual server. No production credentials or server environment was inspected.
7. Review existing lint warnings and unresolved Android large-screen/portrait and lifecycle behavior. Release bundle packaging/signing is deliberately deferred.

## Changed files

- `.github/dependabot.yml`
- `.github/workflows/android-ci.yml`
- `.github/workflows/secrets-audit.yml`
- `.github/workflows/security-hardening-ci.yml`
- `.gitignore`
- `.gitleaks.toml`
- `apps/android/app/src/main/java/in/fcarena/app/MainActivity.java`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth-rate-limit.service.spec.ts`
- `apps/api/src/auth/auth-rate-limit.service.ts`
- `apps/api/src/auth/auth.controller.spec.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.logout.spec.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/guards/jwt-auth.guard.spec.ts`
- `apps/api/src/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/auth/mail.service.ts`
- `apps/api/src/league-wars/league-war-proof.service.ts`
- `apps/api/src/main.ts`
- `apps/api/src/ocr/ocr.service.ts`
- `apps/api/src/player-career/player-profile-image.service.ts`
- `apps/api/src/security/api-rate-limit.guard.spec.ts`
- `apps/api/src/security/api-rate-limit.guard.ts`
- `apps/api/src/security/image-format.spec.ts`
- `apps/api/src/security/image-format.ts`
- `apps/api/src/security/object-authorization.spec.ts`
- `apps/api/src/security/safe-exception.filter.spec.ts`
- `apps/api/src/security/safe-exception.filter.ts`
- `apps/api/src/tournaments/tournament-logo.service.ts`
- `apps/api/test/rate-limit.e2e-spec.ts`
- `docs/security/production-steps-5-7.md`
- `docs/security/npm-audit-findings.json`
