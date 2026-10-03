# Step 19 — Rollback & Disaster Recovery

Status: COMPLETE AT RUNBOOK/SAFETY-GATE LEVEL. Production rollback is intentionally not executed as a test.

Last reviewed: 3 October 2026

## Recovery objectives

Operational targets, not guarantees:

- Database RPO: <= 24 hours when the daily backup pipeline is healthy.
- Core API recovery target: <= 2 hours for a code-only incident with healthy infrastructure.
- Preserve competition integrity over speed when a database restore is required.

A failed or stale backup/restore-verification result blocks risky production changes.

## Frontend rollback

For a bad web deployment:

1. Stop further releases.
2. Identify the last known-good Vercel deployment/source SHA.
3. Prefer Vercel's previous immutable deployment/promotion mechanism or a revert PR to `main`.
4. Verify login, dashboard, fixtures, account deletion and public legal pages after rollback.
5. Record incident/source SHAs.

Do not hide an incompatible API/database change by rolling back only the frontend.

## Backend rollback

FC ARENA's production backend deployment is main-branch driven. The safe code rollback is therefore:

1. Confirm current DB/Redis health and latest verified backup.
2. Identify the last known-good source SHA.
3. Create a reviewed Git revert/revert PR on `main` rather than running a blind `git reset --hard` on the VPS.
4. Let the normal backend deployment workflow rebuild/test/deploy the reverted source.
5. Verify `/api/health`, auth, dashboard and critical tournament reads.
6. Set/verify `FC_ARENA_RELEASE_SHA` when the deployment process supports it.

Generated Prisma files or server-local state must not be erased merely to make Git look clean.

## Database migration rollback

Default rule: **roll forward**, not down.

- Additive indexes/columns can normally remain while code is reverted.
- Do not manually delete production columns/tables to imitate a migration rollback.
- If a migration is data-destructive or corrupts production data, declare an incident and use a verified backup/restoration plan in an isolated rehearsal before touching production.
- Never test a restore over the live production database.
- Preserve the affected database/backup/checksum as incident evidence before recovery.

The existing backup system creates validated custom-format dumps and the restore-verification job proves backups in an isolated PostgreSQL container.

## Redis / cache incident

Redis is treated as disposable cache/coordination state where the application design permits. For an outage:

1. confirm the API health error;
2. repair/restart Redis through normal infrastructure controls;
3. do not flush production Redis merely as a generic troubleshooting step;
4. verify auth/rate-limit/push behavior after recovery.

## VPS loss

1. Provision a clean supported Ubuntu host.
2. Restore repository/deployment configuration from version-controlled sources.
3. Restore secrets from the secure operator secret store, never from Git history.
4. Restore the newest verified PostgreSQL backup.
5. Recreate Redis.
6. Deploy frozen known-good source.
7. Restore DNS/TLS/network configuration.
8. Run health and application smoke tests before reopening traffic.

Keep at least one backup copy outside the primary VPS to protect against total-host loss.

## Bad Android release

An already uploaded Play versionCode cannot be reused or replaced in place.

Response options:

- halt/stage the Play rollout when available;
- keep server APIs backward-compatible with the affected wrapper;
- disable a problematic server-side feature where a safe feature flag exists;
- fix the issue and publish a new artifact with a **higher** versionCode.

Do not try to "rollback" by uploading an older/lower versionCode.

## Recovery verification

`ops/rollback/check-readiness.sh` is a read-only preflight that checks repository state, API health and the latest local backup/checksum before an operator begins a rollback. It does not modify Git, services, containers or the database.

## Incident record

For every production rollback record:

- detection time
- impact
- bad source/release SHA
- known-good SHA
- DB migration state
- backup selected + checksum
- actions taken
- validation results
- recovery time
- follow-up prevention work

Step 19 is complete because rollback/DR paths are defined and existing backup restore verification already demonstrates recoverability without modifying production.
