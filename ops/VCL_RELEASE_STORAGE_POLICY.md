# FC ARENA: VCL Hosting production data and release storage policy

## What is hosted where?

- **GitHub repository and GitHub Actions:** source control, build/test, immutable release bundles. The `offhost-build-artifact.yml` workflow is **manual-dispatch only**.
- **VCL Hosting (`fcarena-prod`):** live Node API and Next web processes, PostgreSQL/Redis, persistent user media, runtime credentials, and minimal release artifacts.
- **Independent encrypted backups:** DB and user media must be verified outside VCL Hosting before any whole-release purge.

There is **no move to an old server or a separate VPS**. A build runner is transient; it does not serve production requests. If Web/API continue to run on VCL Hosting, their compiled runtime binaries and runtime dependencies **must** exist on VCL Hosting. Only one live release and one tested rollback are intended to remain long term.

## Current migration blockers (19 Nov 2026)

- V12 live release: `fcarena-v12-stage-154b8440b92c`; V11 rollback: `playoff-visual-v11-2433159e0d5c`.
- Two services have **47 API / 56 Web environment-file layers**, currently tied to many historical releases. A previous cutover failed; rollback was independently confirmed. Do not retry blindly.
- API WorkingDirectory is `/opt/fcarena/apps/api` (legacy).
- Web effective ReadWritePaths includes historical `.next/cache` directories. These paths block some old-release purges.
- Old historical service drop-ins contain references that must be consolidated separately and reviewed.
- Off-host DB + uploads recovery proof is still needed. Never delete `/opt/fcarena/backups`, `/var/lib/fcarena`, `/opt/fcarena/storage`, or unrelated data.

## Safe near-term cleanup

Only clearly rebuildable **nested** historical `node_modules` and `apps/web/.next/cache` contents may be considered for deletion, using a guarded inventory that excludes actual runtime references, loaded writable paths, active processes, mounts, V12, and V11 rollback. This does **not** remove historical release roots, source, release.env, candidate.env, user files, or backups. Run dry-run first, review candidates, and use a separate explicit apply mode.

## Future VCL deploy protocol (not yet activated)

1. Trigger this workflow on the exact, reviewed commit. GitHub Actions builds API/Web and publishes a SHA256-verified bundle. Do not treat the workflow's existence as a live deployment.
2. Confirm Linux/Node/native module compatibility with `fcarena-prod` using a staging-only smoke test (Ubuntu-based build output may not be portable to every server OS).
3. Copy bundle to a **new** release directory; verify SHA256; create a fresh systemd drop-in rather than adding dozens of historical overrides.
4. Use release-independent root-only environment and permanent media paths. Preserve the real loaded environment precedence; do not overwrite `/etc/fcarena/push/firebase-push.env`.
5. Run tests and an isolated restore/migration rehearsal. After explicit recovery and health gates, switch API and Web in a controlled maintenance window.
6. Retain **current + verified rollback**; clean older release directories only after all runtime/cron/systemd/env references are removed and off-host recovery is confirmed.
7. Enforce retention in the deploy workflow once step 6 is proven, not through blind cron `rm -rf`.

**Security:** Treat runtime artifacts as sensitive; keep GitHub permissions scoped, avoid embedding secrets during CI, and never upload database dumps, passwords, tokens, user media or production environment files into GitHub artifacts.
