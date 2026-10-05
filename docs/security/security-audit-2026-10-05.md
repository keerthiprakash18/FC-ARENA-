# FC Arena security audit — 2026-10-05

Base: `1cb099a9c7ec45a70c78ed22ca9d0f2d30fa4c2e`.
Branch: `security/production-audit-oct05`.

This is a source/dependency audit with automated regression checks and limited read-only production HTTP checks, not a claim that the application cannot be hacked. No production records, credentials, Android versions or release artifacts were changed. No production password, environment value, private key or keystore was printed or rotated.

## Verified fixes

- **Login account quota bypass:** account lookup removed zero-width characters but the limiter did not. Both now use the same normalizer, preserving existing mobile input handling. A regression test uses six equivalent identifiers from different IP addresses: only five reach credential verification, the sixth receives 429.
- **New-password truncation:** registration/reset accepted up to 256 characters although bcrypt only uses the first 72 UTF-8 bytes. New passwords now reject lengths exceeding 72 bytes, including multibyte characters. Existing login inputs and stored hashes remain compatible. Bcrypt cost remains 12. No password is trimmed, rewritten or rehashed by this change.
- **Audit failure treated as success:** an npm registry error JSON without a vulnerability map could pass the production gate. The gate now requires a complete, consistent audit report and successful audit execution. Raw registry/proxy output is never printed by that gate. Regression tests exercise malformed, incomplete and failed reports.
- **Local database exposure:** the development Compose PostgreSQL/Redis ports now bind to loopback rather than all host interfaces. Existing volumes and database credentials are unchanged. This does not modify the production server firewall.
- Added authorization regression tests proving that unauthorized global/league/tournament role creation and cross-league role deletion cannot reach mutation/audit writes.
- Added a read-only production environment checker with fixed, value-free diagnostics for weak/missing/shared JWT secrets, public-prefixed server credentials, debug/TLS-bypass flags, database configuration, CORS origins, proxy hops and Firebase Admin configuration. It never rotates secrets and is not an unverified production startup requirement.
- Expanded ignore rules for additional private-key/environment/backup variants. Added weekly secret and dependency/security CI runs; secret scans also run on main pushes. Added gate/environment regression tests to CI and included security script changes in workflow triggers.

## Requested controls reviewed

| Area | Evidence and limits |
| --- | --- |
| API keys / environment variables | Server provider/JWT/database credentials are read from environment variables. Browser source only references the public API base URL; no private provider credentials were found there. Actual hosting secret values were not accessed. |
| Admin routes / access control | Protected controllers use JWT guards. Current database account status and role replace stale JWT role claims. Role-management, league, tournament, results, fair-play and operational services contain scoped authorization checks. Tests cover cross-object denials; this is not an exhaustive multi-account staging penetration test. |
| Authentication / sessions | Existing HS256 access JWT verification, 15-minute access lifetime, hashed refresh sessions, transactional refresh rotation, secure HttpOnly production refresh cookies, password-reset refresh revocation and logout revocation retained. Access JWTs can remain valid until expiry after logout/reset; immediate revocation requires a carefully tested session design. |
| Forms / XSS | Global DTO validation rejects unknown fields. User-facing React text is escaped by React. The inspected raw HTML sink is a fixed theme bootstrap script, not user HTML. Existing CSP blocks objects and framing, but still allows inline scripts for the current Next bootstrap. A nonce CSP rollout remains a separate tested improvement. Blanket stripping would corrupt valid user input and passwords. |
| API / rate limits | Database-backed atomic account/action and global IP quotas remain, with auth stricter than general traffic. Identity normalization bypass fixed. Effective source-IP enforcement depends on the actual reverse proxy configuration and direct backend network access. |
| CORS / headers | Exact API origin allowlist and credential settings retained. Live preflight allowed https://fcarena.in and denied https://untrusted.example with no ACAO header. Denied preflight currently returns sanitized 500, not 403. Web/API live responses had nosniff, frame denial and HSTS; web CSP present. Public web HTML had wildcard ACAO; the sensitive API preflight did not. |
| Debug modes | API production entry point has no debugger flag; Android WebView debugging is gated on BuildConfig.DEBUG. Actual server process flags/NODE_ENV require the value-free operational check below. |
| Uploads | Existing size limits, decoded image-format/MIME checks, generated names, image processing and fixed provider destinations retained. These prevent trusting a user-provided filename as a filesystem path. |
| SQL / database | Prisma access and inspected raw SQL use placeholders, including the dynamic IN clause generated only from placeholder indices. No production migrations or DB queries were run. Actual DB privileges, firewall and TLS require infrastructure verification. |
| Exposed files | Read-only HEAD requests returned 404 for web /.env, web /.git/config and API /.env. This checks those paths only. Git ignore rules protect normal secret/backup formats. |
| Logging / responses | Existing generic 5xx filter and redacted provider logs retained. Audit gate no longer dumps untrusted registry errors. No confirmed credential output was found in inspected application logging. |

## Secret scan

Checksum-verified Gitleaks 8.30.1 scanned all locally reachable Git history: 1,099 diff-bearing commits; zero findings after the pre-existing narrow public/template classifications. Firebase Android `google-services.json` contains public client configuration, not a Firebase Admin private service account. Google Cloud application/API restrictions still need operational verification. Scanning cannot detect every possible custom secret format; no credential rotation is indicated by this scan.

## Dependency policy

Baseline npm audit: 0 critical, 11 high, 3 moderate, 2 low (16 affected package entries, including transitive parent duplicates).

Removed unused `@nestjs/mau` and its alternative `nest deploy` command (actual CI deployment is unchanged), plus unused `nodemailer` and its types. Email is sent with the existing Brevo fetch implementation. Updated compatible `pg`, `sharp` and available gaxios dependencies. Final dependency counts and MySQL resolution are recorded in the verification supplement below.

`deepmerge-ts` 8 fixes its advisory but has documented breaking changes; Prisma 7.10 pins version 7.1.5. No forced major Prisma/deepmerge downgrade/upgrade was applied. The existing exact-advisory exception expires 2026-11-15. `braces` currently has no patched version and is in the development lint toolchain. Remaining high findings must not be described as zero vulnerabilities.

Sources: https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0 and https://github.com/advisories/GHSA-vfj7-8cjw-p6xm .

## Validation at initial review

- API build: pass.
- Web build: pass.
- API/web lint: pass with existing warnings (4 API, 161 web).
- API unit suite: 165 passed, 29 files, including authorization, image validation, JWT, safe-error, rate-limit and new password/quota tests.
- Root Node regression suite: 30 passed.
- Local E2E: infrastructure-blocked, with connection failures to local PostgreSQL/Redis; 13 failed, 2 passed, 2 skipped. No production database was substituted. CI runs the same suite against isolated PostgreSQL/Redis services; its result must be checked before merge.
- Read-only production HEAD/preflight checks: completed as described above.

## Operational checks still required

On the production server, with Node 24 and the actual protected environment file, run:

```sh
node --env-file=/path/to/protected-api.env scripts/check-security-env.mjs
```

This prints only configuration labels and pass/fail/review counts. Keep the environment file on the server. Do not paste its contents or secrets into a ticket. Review any failures before changing credentials; rotation is manual and coordinated. The checker validates configuration shape, not actual secret entropy or network isolation.

Verify least-privilege database runtime credentials, network/TLS restrictions, correct trusted proxy hops, no publicly reachable debugger/database/Redis ports, Firebase API/application restrictions, and server environment/file permissions. Those infrastructure properties cannot be proven from repository source or public HTTP headers alone.

## Dependency and verification supplement

- Clean installation with the repository-declared npm 12.0.2: pass.
- MySQL2 updated from 3.15.3 to 3.24.5 through an explicit root override; both reported MySQL advisories removed. This is a compatible version within major 3; FC Arena continues using PostgreSQL. The obsolete MySQL audit exception was removed.
- Final npm audit: **0 critical, 8 high, 2 moderate, 0 low**. High entries are five development lint-chain entries (`braces`, `micromatch`, `fast-glob`, Next ESLint plugin/config) and three Prisma configuration-chain entries (`deepmerge-ts`, `@prisma/config`, `prisma`). These represent two remaining high-severity advisory chains, not eight independent app exploits. Moderate entries are `uuid` and its `gaxios` parent in optional Firebase storage dependencies.
- Production dependency gate: pass **with the pre-existing, narrowed Prisma advisory exception**, expiring 2026-11-15. Critical findings can never use that exception. A passing gate is not a zero-vulnerability result.
- All changes must pass the PR's clean-install build/lint/unit/E2E/security checks before merge. CI results and the final commit are recorded on the pull request so this initial audit snapshot is not mistaken for a live deployment status.
