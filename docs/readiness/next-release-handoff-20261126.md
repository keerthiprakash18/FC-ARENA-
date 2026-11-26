# FC ARENA NEXT release handoff — 26 November 2026

Status: **development in progress; production activation not performed**. This handoff records observed evidence. It does not establish completion of the full product transformation or authorize a release. Recheck all time-sensitive observations against the final reviewed commit.

## Verified production baseline

Read-only public requests and trusted SSH inspection on 26 November 2026 confirmed:

| Check | Observed result |
|---|---|
| Public WEB `/web-release` | `02cd30152cd2e5f5478e079daee2e0d985a2cc5a` |
| Public API `/api/health` | Same SHA; API, PostgreSQL and Redis connected; `healthy` |
| Managed pointer | `/etc/fcarena/managed-release/current.json`, same SHA |
| Current runtime | `/opt/fcarena-deployments/awards-full-02cd30152cd2/runtime` |
| Four local replicas | WEB ports 3000/3001 and API ports 4000/4001 all return the current SHA; API instances `api-primary` / `api-secondary` |
| Effective launch | Existing `/opt/fcarena-ops/release/managed_runtime.py launch`; all four systemd services active |
| API working directory | `/opt/fcarena/apps/api`; existing persistent storage and environment precedence retained |
| Current retained rollback | `8000ebbd5ad54986e66976d1deccaf8937402728`, `/opt/fcarena-deployments/awards-full-8000ebbd5ad5/runtime`; API entrypoint, WEB build and dependencies present |
| Host ABI | `fcarena-prod`, x86_64, glibc 2.39, Node v24.22.1 |
| Storage admission | Existing `storage_retention.py preflight` PASS: 14,985,728,000 free bytes (13.96 GiB), minimum 12 GiB |
| Schema / migration parity | All 52 actual live Prisma schema/migration files match this worktree after newline normalization; no missing or extra candidate files |

The initial public API response timestamp was `2026-11-26T05:24:37.123Z` (10:54:37 IST). Presence of rollback files is **not** a new rollback rehearsal. The historical SHAs in older readiness documents must not replace this independently observed baseline. No production service restart, deployment pointer change, migration, cleanup, or data write was performed in this audit.

## Existing private recovery evidence

The public backup endpoint reported `healthy`, encryption enabled, latest archive copied off-host, and complete provider assets. At the initial probe its local/off-host/restore ages were 3.39 / 0.45 / 10.3 hours respectively.

The existing owner-private PC restore report records:

- Verified at `2026-11-25T19:06:45.452867Z` (26 November, 00:36:45 IST): PASS; 68 tables, 51 finished migrations, zero unresolved migrations; 143 media files and 111 provider assets verified, zero unavailable assets.
- Restore-tested encrypted archive SHA-256: `e5e8baca0d1170bf8fc58fc0e2a873d46b7217c1391cc2df6531576b3820dc59`.
- Latest copied archive: `fcarena-20261126T020034Z-d03d12.bundle.gpg`, copied at `2026-11-26T04:57:39.506386Z`, SHA-256 `1ff2494c076eeac5d23e630069afca85c6d51f15e23b2b699154c29997b37661`.
- The original scheduled copy reported `restoreVerifiedThisRun: false`. This audit subsequently decrypted and actually restored that exact latest archive locally with the existing private recovery workflow at `2026-11-26T05:35:06.229238Z` (11:05:06 IST): PASS; 68 tables, 51 finished migrations, zero unresolved migrations, 143 media files, 111 provider assets and zero unavailable assets. Its restored ciphertext SHA-256 matches `1ff2494c076eeac5d23e630069afca85c6d51f15e23b2b699154c29997b37661`. No remote receipt or production backup state was updated. This used the existing PostgreSQL 18 Windows binary in a new disposable loopback cluster; it is not proof of an exact PostgreSQL 17 candidate rehearsal. Local Docker Desktop's Linux daemon was unavailable during this audit.

The private recovery directory and original signing assets remain outside Git. No key, password, database dump, image, or user record is included in this handoff. Before final release, renew recovery as needed with the established private PC workflow and record the exact archive and restoration outcome; do not weaken the freshness gates or overwrite a live database. Read-only VCL capacity inspection additionally confirmed the reviewed `postgres:17` and `redis:7-alpine` images are already present; the candidate-only staging adapter can use them without adding infrastructure or pulling unreviewed images.

## Inherited candidate evidence

[Draft PR #228](https://github.com/keerthiprakash18/FC-ARENA-/pull/228) was independently rechecked at `ec3b26e72eac57ed66f46aac5d733f75c6a9cff0`. All 12 CI workflows completed successfully, including Android API 33, 34, 35 and 36 launch/scroll jobs. This is emulator evidence, not physical-device acceptance. The manual readiness workflow's contract job passed, but its actual read-only candidate-verification job was skipped on the PR event.

[Off-host build run 45759959208](https://github.com/keerthiprakash18/FC-ARENA-/actions/runs/45759959208) completed successfully for that exact SHA. Artifact `15089432193`, named `fcarena-vcl-runtime-ec3b26e72eac57ed66f46aac5d733f75c6a9cff0`, was unexpired and 246,973,147 bytes. GitHub reports artifact digest `sha256:f7a28869a9d71ea9e5bd5c94ecaa1e19dae5070e56abb44df714004878452f23`. This is the GitHub artifact digest; the runtime tarball's separate `SHA256SUMS` must still be verified after downloading. Any follow-up commit invalidates this inherited candidate as the final release identity and requires its own CI, artifact, and rehearsal.

## Release gate improvement in this development branch

The checked-in managed runtime activation now rejects a staging proof unless it is a private root-owned regular file beside the candidate runtime, reports PASS for the exact candidate and current baseline, and contains literal `true` values for authenticated API, browser, cross-instance Redis and replica failover. A timezone-qualified verification timestamp must be within 24 hours, allowing five minutes of clock skew. The gate runs before managed-pointer or service-file mutations. Thirteen managed runtime regression tests passed locally, including failed/stale/foreign/truthy/untrusted proof rejection and the existing storage, schema, environment and rollback protections.

This source improvement has not been installed on VCL. Installing reviewed release tooling must be an explicit part of the authorized release; running an older server copy does not exercise the new gate.

## Exact artifact and isolated rehearsal procedure

Continue using the existing GitHub build, private workstation adapters, disposable PostgreSQL 17/Redis staging, and managed runtime architecture. Do not build or install application dependencies on VCL.

1. Finish development and acceptance. Freeze one reviewed main SHA and record its complete source diff from the observed live baseline. Recheck required workflow results at that exact SHA. Build its immutable artifact with `.github/workflows/offhost-build-artifact.yml`; record the run ID, artifact ID, tarball checksum and release marker. A PR artifact from an earlier SHA is not a substitute.
2. Download the exact artifact to the private workstation. Run `python ops/verify-offhost-runtime-bundle.py --output-dir <download-directory> --release <frozen-sha>`; reject identity, checksum, archive-path, secret/user-data or runtime-only startup failures.
3. Run the existing manual read-only readiness workflow with that build run, frozen SHA and freshly observed WEB/API SHAs. Its PASS does not replace host, restore or product acceptance.
4. Recheck the existing storage admission command before transferring or extracting anything. At the observed 13.96 GiB free, do not assume unbounded staging capacity. Retain current runtime, protected rollback, persistent data and all referenced historical releases. No cleanup is included in this release authorization.
5. Adapt the existing workstation `duo-lineup-guarded-deploy.py` and corresponding stage/replica tools with the reviewed final SHA, current baseline, exact source-file set, successful build run and checksum. These are existing local Windows-compatible Python adapters, not a reusable checked-in PowerShell deployer. Their historical hardcoded SHAs must not be executed unchanged. Verify source allowlists and require stage-only operation before any apply flag.
6. Rehearse the exact extracted Linux artifact with the existing `prepare-awards-runtime.py`, `replica-stage.py`, `stage-api-entry.mjs` and Redis/failover fixtures. Reuse their explicit synthetic database names, loopback bindings, bounded containers/services, disabled scheduled workers and candidate-only storage. Do not inherit live database/media credentials into staging. Existing production-target Next rewrites require the established isolated staging proxy; setting an environment variable after build does not rewrite the compiled target.
7. Test real player/admin login and authorized navigation, profile persistence, current-week progress, SOLO/DUO/TEAM fixtures/results/standings/awards, pending admin queue, community permission boundaries, and all changed routes. Verify actual candidate screenshots at mobile/desktop widths and required themes. Exercise cross-instance updates and stopped-replica failover. Retain real evidence, then produce a private `staging-proof.json` from those checks, bound to the final SHA and unchanged baseline. Copying a previous proof or hand-authoring successful flags is forbidden.
8. Rehearse rollback against disposable candidate/baseline services and verify retained static-file compatibility. Stop candidate-only staging services when finished, and preserve the recorded evidence. Capture fresh public and local replica identities, recovery state, disk space and protected rollback immediately before the final checkpoint.

## Windows Terminal operator checkpoint

The user-provided transformation brief reserves final production activation for the owner's Windows Terminal after readiness and approval of the **exact** release. The candidate, artifact, rehearsal and full product acceptance are not yet final, so there is no approved activation command to execute now.

When those gates are evidenced, the existing managed activation command remains:

```powershell
ssh.exe -T -i C:/Users/micha/.ssh/id_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=yes root@45.129.87.8 "python3 /opt/fcarena-ops/release/managed_runtime.py activate --runtime /opt/fcarena-deployments/<reviewed-stage>/runtime --sha <frozen-sha> --expected-old <fresh-live-sha> --staging-proof /opt/fcarena-deployments/<reviewed-stage>/staging-proof.json"
```

This is an operator command template, **not** an approval request or a runnable final release. Replace its placeholders only from frozen reviewed evidence. Install the reviewed managed tooling under the same authorization before activation. Do not invoke `npm start:prod` or apply migrations during this step. The current scope has no schema change; any new schema delta requires separate migration review and approval.

After an approved switch, verify all four exact release markers, public home/login/affected pages and chunks, API/DB/Redis health, authenticated read-only critical journeys and Android WebView. On failure use the candidate's retained root-private rollback snapshot with:

```powershell
ssh.exe -T -i C:/Users/micha/.ssh/id_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=yes root@45.129.87.8 "python3 /opt/fcarena-ops/release/managed_runtime.py rollback --runtime /opt/fcarena-deployments/<failed-reviewed-stage>/runtime"
```

Rollback restores the prior managed pointer and service configuration; it must not restore a database over production or delete releases/user files. Android Play publication remains a separate authorized action.

## Remaining release blockers

- Final reviewed development scope, consolidated ten-phase acceptance, and frozen main SHA are not complete.
- The final SHA's CI/artifact/checksum/read-only readiness and exact PostgreSQL 17/Redis/authenticated browser/replica/rollback rehearsal are pending.
- Full rendered responsive/theme/accessibility acceptance and physical Android-device evidence remain distinct from the inherited CI results.
- Recovery must be rechecked for the final checkpoint; latest copied archive restoration and exact target compatibility must be stated precisely.
- The owner has not approved an exact final production release at the reserved Windows Terminal checkpoint.

Production changed by this audit: **no**. Migration count: **zero**. Historical releases, user accounts, results, awards, chat, uploads, environment files, keys and signing assets: **retained**.
