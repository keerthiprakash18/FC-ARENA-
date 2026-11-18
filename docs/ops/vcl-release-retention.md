# FC ARENA VCL release retention policy

This feature is intentionally **read-only**. As of the most recent audited
diagnostic, production was approximately 81% full (17 GB free). Do not respond
by deleting production deployments or PostgreSQL dumps automatically.

Authorized host: `fcarena-prod` only.

Usage (run from trusted Windows SSH terminal after verifying the SSH host key):

```powershell
ssh.exe -T -o BatchMode=yes -o StrictHostKeyChecking=yes root@45.129.87.8 "bash /opt/fcarena/ops/vcl-release-retention-audit.sh"
```

To run from a staged candidate before it has become the active checkout, send
the exact audited script body to `bash -s` via the existing trusted SSH
connection. Nothing is removed.

A human must verify **before any potential future pruning**:
1. Current working directory AND ExecStart for both services.
2. Every effective and rollback systemd drop-in, including all legacy drop-ins.
3. Actual source/runtime paths that must remain for rollback, old Next.js static chunks.
4. Two previously proven Web/API releases and the current release.
5. Verified and restorable PostgreSQL dumps and media backups.
6. Post-cleanup free disk space, nginx, API health and release fingerprints.

Never delete: `/opt/fcarena` live checkout, `/var/lib/postgresql`, verified
backups, `/etc/systemd`, any `.env`, any active runtime or any directory
that contains a recovery artifact. Do not run `rm -rf` against an inferred
release pattern.

No automatic destructive cleanup is performed by audit or deploy workflows.
