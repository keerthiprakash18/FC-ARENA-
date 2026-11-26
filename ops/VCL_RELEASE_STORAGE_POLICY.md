# FC ARENA: VCL Hosting production data and release storage policy

## What is hosted where?

- **GitHub repository and GitHub Actions:** source control, build/test, immutable release bundles. The `offhost-build-artifact.yml` workflow builds on relevant `main` updates, manual dispatch, and selected PRs; **it does not deploy**.
- **VCL Hosting (`fcarena-prod`):** live Node API and Next web processes, PostgreSQL/Redis, persistent user media, runtime credentials, and minimal release artifacts.
- **Independent encrypted backups:** DB and user media must be verified outside VCL Hosting before any whole-release purge.

There is **no move to an old server or a separate VPS**. A build runner is transient; it does not serve production requests. If Web/API continue to run on VCL Hosting, their compiled runtime binaries and runtime dependencies **must** exist on VCL Hosting. Only one live release and one tested rollback are intended to remain long term.

## Managed storage policy (24 Nov 2026)

Owner approved cleanup of the reviewed 8.16 GiB candidate set and future retention
with the same boundaries. This approval does not cover historical release roots,
configuration references, source, media, database or backups.

- Development/builds remain on the PC and GitHub Actions. VCL must retain the
  compiled running application and its runtime dependencies.
- At inventory: 115 deployment directories used 49.71 GiB; the separate download
  cache used 3.68 GiB. Disk usage was 90%, with 9.10 GiB available. Upload/storage
  folders were small; this figure does not include PostgreSQL or cloud assets.
- Managed live: `71a51ec3f96c0f9140ab17a2c52fb8a5c681c4e7` at
  `/opt/fcarena-deployments/awards-full-71a51ec3f96c/runtime`; verified rollback:
  `beb2292651f67383bbebcf9c66c9c6c2f526fb11` at
  `/opt/fcarena-deployments/premium-20261124-beb2292651f6/runtime`.
- 71 historical releases still have configuration, process or other protected
  references. They stay protected. Current + rollback is the intended long-term
  target, not a claim that the old configuration layers have been retired.

`ops/release/storage_retention.py plan` is read-only. It inventories configuration,
processes, open descriptors, mounts and cross-release symlinks. It selects only
literal nested `node_modules`/web cache directories in unreferenced releases and
recognized downloaded archives under the dedicated download cache. It rejects
symlink ancestors and protects the live runtime, verified rollback and V11/V12.

Manual `apply --plan FILE --approved-plan HASH --offhost-receipt FILE` validates
the complete batch against a fresh inventory before deletion. A changed pointer,
changed file, new reference, unhealthy replica, missing archive copy or invalid
plan hash stops cleanup. Activation and cleanup share the release lock. No app
service restart or database migration is part of cleanup.

The root-owned `/etc/fcarena/release-storage-policy.json` records the owner's
standing scope. The daily `fcarena-release-storage.timer` runs `cycle`: at least
24 hours old, at most 10 GiB per cycle, same reference/path safeguards. Archive
deletion additionally requires a PC SHA-256 receipt refreshed within 48 hours.
If the PC is offline, those archives stay on VCL. A failure appears as a failed
systemd service; it never falls back to a broader deletion command.

The PC-side `storage_offhost.py --host root@HOST --identity PRIVATE_KEY_PATH
--directory PRIVATE_PC_FOLDER --cycle` downloads a fresh plan, copies only its
recognized archives, hashes the actual local bytes, and uploads a private receipt.
It can run as a logged-in-user Windows scheduled task; it needs no plaintext
password or additional server. The PC must be on and its existing SSH key usable.

Before **transferring or extracting** a new release, run:

```sh
python3 /opt/fcarena-ops/release/storage_retention.py preflight
```

This read-only gate requires all four instances healthy and at least 12 GiB free.
Managed activation also enforces it when the policy is installed. The desktop
guarded deployment script includes it before staging. Build on GitHub, transfer
one immutable artifact, and never copy persistent media into a release directory.
If space cannot be recovered within the approved scope, stop the new deployment
and review the referenced legacy configuration; do not delete those releases.

Disable future cleanup with `systemctl disable --now fcarena-release-storage.timer`
and disable the PC task. This leaves the app running. Retain private cleanup
plans, receipts and `/var/lib/fcarena-release-storage/last-cleanup.json` as evidence.

## Verified relocation of historical releases (26 Nov 2026)

The owner explicitly requested removal of accumulated deployment files, preservation
of all user data/features, and future storage of archives on the PC. This extends
the earlier package/cache-only scope to **verified off-host relocation** of
unreferenced whole release roots. It does not authorize deleting live data,
referenced releases, the verified rollback, or unverified archives.

- `retire_shadowed_config.py` retires only `ExecStart`, `EnvironmentFile`, and
  `WorkingDirectory` directives overridden by the final managed configuration.
  Original bytes remain private for recovery. Commands, environments, security
  settings, writable paths, and PIDs must compare identically after daemon-reload;
  any mismatch restores the original files. There is no application restart.
- `release_escrow.py` checks current/rollback, effective reference inventory,
  symlinks, mounts, processes, file descriptors, database file references, and fresh
  complete encrypted off-host backup/restore proof. It records every historical
  tree before streaming an archive directly to the PC. No archive is stored on VCL.
- `receive_release_escrow.py` compares the actual PC bytes with the server stream
  SHA-256 and checks every tar entry against the exact release inventory. Only then
  does it issue a private receipt. Server `apply` checks the receipt, freshness,
  references and every tree again under the activation lock before removal.
- The separate root-owned `/etc/fcarena/release-escrow-policy.json` must approve
  `pc-verified-unreferenced-release-roots-v1` for the PC `--cycle` mode. Cycles select
  only releases at least 24 hours old, at most 10 roots and 10 GiB per run. The
  existing logged-in-user PC maintenance task runs the receiver after archive
  escrow. If the PC is unavailable, disk space is insufficient, or recovery proof
  is stale, old releases remain protected and maintenance reports failure.
- GitHub outer `runtime-artifact.zip` files now participate in archive escrow.
  A PC with the matching inner tarball can reconstruct the exact outer ZIP from
  bounded header/trailer metadata; its complete SHA-256 must still match before
  the server may remove the original. Filenames include the release SHA to avoid
  collisions between different outer ZIPs.

Keep builds in GitHub Actions and the PC. Required current/rollback runtimes,
stable user files, credentials and data remain on VCL. Never promise an empty
deployment directory while those applications are served from VCL.

Disable whole-release relocation by disabling the PC task or removing its
separate standing policy; the guarded package/cache timer can remain enabled.
Private plans, transfer receipts and results remain under
`/var/lib/fcarena-release-storage`; sensitive historical archives stay on the
owner's private PC and must never be uploaded to GitHub.

## Historical baseline (20 Nov 2026; superseded by current live inventory)

- Current live V12: `/opt/fcarena-deployments/fcarena-v12-stage-154b8440b92c` (SHA `154b8440b92ca18f15fc186ee17019820cf8e116`). Protected V11 rollback: `/opt/fcarena-deployments/playoff-visual-v11-2433159e0d5c`. GitHub main is not automatically live.
- API and WEB service guard restarts, stable `/etc/fcarena` environment-file precedence and effective WEB cache writable paths were verified in Nov 2026. The **47 API and 56 WEB historical environment layers and older systemd drop-ins still require a separate review**; never blindly remove them. API `WorkingDirectory` intentionally remains `/opt/fcarena/apps/api`.
- Production target ABI observed read-only on 20 Nov: Ubuntu 24.04, x86_64, glibc 2.39, Node 24.22.1, API and WEB active. Matching GitHub runner packaging and native module smoke can reduce compatibility risk, but does not prove a VCL runtime launch or authenticated feature parity.
- Off-host Windows DB dump was restore-verified in isolation with 67 tables and 49 migrations. On 20 Nov a further 32 persistent-source files were copied to Windows with SHA-256 parity PASS; that copy **was not an application/media restore rehearsal**.
- Arena Talk media directory is release-independent, contains 0 files at audit time, and 14 local media archives passed checksum verification but contained 0 image entries. **Real, nonempty media off-host recovery is not proven by those empty archives or synthetic CI.** The other persistent roots must be retained even if their purposes are not fully cataloged.
- Production storage audit found 101 deployment directories, with ~29 GB free (67% usage); no current disk emergency. Old release deletion remains unauthorized.

## Safe near-term cleanup

Only clearly rebuildable **nested** historical `node_modules` and `apps/web/.next/cache` contents may be considered for deletion, using a guarded inventory that excludes actual runtime references, loaded writable paths, active processes, mounts, V12, and V11 rollback. This does **not** remove historical release roots, source, release.env, candidate.env, user files, or backups. Run dry-run first, review candidates, and use a separate explicit apply mode.

## Release protocol

1. Trigger this workflow on the exact, reviewed commit. GitHub Actions builds API/Web and publishes a SHA256-verified bundle. Do not treat the workflow's existence as a live deployment.
2. Confirm Linux/Node/native module compatibility with `fcarena-prod` using a staging-only smoke test (Ubuntu-based build output may not be portable to every server OS).
3. Copy bundle to a **new** release directory; verify SHA256; create a fresh systemd drop-in rather than adding dozens of historical overrides.
4. Use release-independent root-only environment and permanent media paths. Preserve the real loaded environment precedence; do not overwrite `/etc/fcarena/push/firebase-push.env`.
5. Run tests and an isolated restore/migration rehearsal. After explicit recovery and health gates, switch API and Web in a controlled maintenance window.
6. Retain **current + verified rollback**; clean older release directories only after all runtime/cron/systemd/env references are removed and off-host recovery is confirmed.
7. Use the scoped owner-approved retention guard above. Whole-release removal is
   still a separate review; no blind cron `rm -rf` is permitted.

**Security:** Treat runtime artifacts as sensitive; keep GitHub permissions scoped, avoid embedding secrets during CI, and never upload database dumps, passwords, tokens, user media or production environment files into GitHub artifacts.
