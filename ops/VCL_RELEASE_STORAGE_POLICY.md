# FC ARENA: VCL Hosting production data and release storage policy

## What is hosted where?

- **GitHub repository and GitHub Actions:** source control, build/test, immutable release bundles. The `offhost-build-artifact.yml` workflow builds on relevant `main` updates, manual dispatch, and selected PRs; **it does not deploy**.
- **VCL Hosting (`fcarena-prod`):** live Node API and Next web processes, PostgreSQL/Redis, persistent user media, runtime credentials, and minimal release artifacts.
- **Independent encrypted backups:** DB and user media must be verified outside VCL Hosting before any whole-release purge.

There is **no move to an old server or a separate VPS**. A build runner is transient; it does not serve production requests. If Web/API continue to run on VCL Hosting, their compiled runtime binaries and runtime dependencies **must** exist on VCL Hosting. Only one live release and one tested rollback are intended to remain long term.

## Verified status (20 Nov 2026; production remains on VCL)

- Current live V12: `/opt/fcarena-deployments/fcarena-v12-stage-154b8440b92c` (SHA `154b8440b92ca18f15fc186ee17019820cf8e116`). Protected V11 rollback: `/opt/fcarena-deployments/playoff-visual-v11-2433159e0d5c`. GitHub main is not automatically live.
- API and WEB service guard restarts, stable `/etc/fcarena` environment-file precedence and effective WEB cache writable paths were verified in Nov 2026. The **47 API and 56 WEB historical environment layers and older systemd drop-ins still require a separate review**; never blindly remove them. API `WorkingDirectory` intentionally remains `/opt/fcarena/apps/api`.
- Production target ABI observed read-only on 20 Nov: Ubuntu 24.04, x86_64, glibc 2.39, Node 24.22.1, API and WEB active. Matching GitHub runner packaging and native module smoke can reduce compatibility risk, but does not prove a VCL runtime launch or authenticated feature parity.
- Off-host Windows DB dump was restore-verified in isolation with 67 tables and 49 migrations. On 20 Nov a further 32 persistent-source files were copied to Windows with SHA-256 parity PASS; that copy **was not an application/media restore rehearsal**.
- Arena Talk media directory is release-independent, contains 0 files at audit time, and 14 local media archives passed checksum verification but contained 0 image entries. **Real, nonempty media off-host recovery is not proven by those empty archives or synthetic CI.** The other persistent roots must be retained even if their purposes are not fully cataloged.
- Production storage audit found 101 deployment directories, with ~29 GB free (67% usage); no current disk emergency. Old release deletion remains unauthorized.

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
