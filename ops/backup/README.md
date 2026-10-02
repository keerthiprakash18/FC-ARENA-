# FC Arena production backup runner

V3.3 ships a fail-closed PostgreSQL backup runner at `ops/backup/fcarena-backup.sh`.

The script:

- creates a PostgreSQL custom-format dump with `pg_dump`;
- validates the raw archive with `pg_restore --list`;
- encrypts the validated dump with GPG before it becomes the retained backup artifact;
- writes through temporary files and only renames after validation + encryption;
- creates SHA-256 integrity metadata for the encrypted artifact;
- removes encrypted backup files older than the configured retention period;
- reports success/failure metadata to the FC Arena API;
- never sends database contents through the API.

## Required production environment

```bash
DATABASE_URL=postgresql://...
BACKUP_REPORT_TOKEN=<long random secret>
BACKUP_ENCRYPTION_RECIPIENT=<gpg recipient id or fingerprint>
BACKUP_DIR=/var/backups/fcarena
BACKUP_RETENTION_DAYS=14
BACKUP_REPORT_URL=https://api.fcarena.in/api/internal/ops/backups/report
BACKUP_STORAGE_KIND=LOCAL_ENCRYPTED
```

The API process must receive the same `BACKUP_REPORT_TOKEN`. Do not commit that token, the database URL, or private GPG keys.

The backup host needs the public GPG key for `BACKUP_ENCRYPTION_RECIPIENT`. Keep the corresponding private key offline or in a separate recovery location so a server compromise does not expose both the database and its decryption key.

## Recommended schedule

V3.3 includes hardened systemd templates:

- `ops/backup/fcarena-backup.service`
- `ops/backup/fcarena-backup.timer`

Production installation should use a dedicated `fcarena-backup` OS account, a root-owned `/etc/fcarena/backup.env` with mode `600`, and `/var/backups/fcarena` writable only by the backup account.

Example installation flow:

```bash
sudo install -o root -g root -m 0755 ops/backup/fcarena-backup.sh /usr/local/sbin/fcarena-backup
sudo install -o root -g root -m 0644 ops/backup/fcarena-backup.service /etc/systemd/system/fcarena-backup.service
sudo install -o root -g root -m 0644 ops/backup/fcarena-backup.timer /etc/systemd/system/fcarena-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now fcarena-backup.timer
```

The timer runs daily at 02:30 UTC with up to 15 minutes of randomized delay and uses `Persistent=true`, so a missed run is triggered after the host returns.

A backup is considered healthy by the Admin System page when the latest successful report is no more than 30 hours old.

## Restore drill

At least monthly:

1. Copy the newest `.dump.gpg` file to a non-production recovery machine.
2. Decrypt it with the recovery private key.
3. Validate with `pg_restore --list`.
4. Restore into a separate PostgreSQL database.
5. Run API migrations and FC Arena smoke tests against that restored database.

A backup that has never been restored is not considered fully verified.

Do not store production database dumps or private GPG keys in Git, Vercel, or GitHub Actions artifacts.


## Off-server backup requirement

Production should set `BACKUP_REQUIRE_REMOTE=true` and configure
`BACKUP_REMOTE_DEST` to a dedicated rclone destination such as an S3/B2
bucket or separate recovery host. When remote backup is required, the job fails
closed if the encrypted archive cannot be copied off the application server.
Only encrypted `.dump.gpg` artifacts and SHA-256 sidecars are copied.

Use a storage-side lifecycle policy for remote retention, and keep the GPG
private recovery key outside the application VPS.

## Automated restore-pipeline verification

The `.github/workflows/backup-restore-ci.yml` workflow proves the complete
backup toolchain with synthetic data: dump, archive validation, GPG encryption,
required off-server-style rclone copy, checksum verification, decryption,
restore into a separately named recovery database, and restored-data checking.

The guarded recovery helper is
`ops/backup/fcarena-restore-verify.sh`. It refuses to run unless the target
database name contains `restore`, `recovery`, or `verify` and
`FC_ARENA_RESTORE_CONFIRM=VERIFY_ON_RECOVERY_DATABASE`.

A periodic real-production recovery drill on a separate recovery host is still
required because synthetic CI cannot prove that a specific production backup
contains the expected live data.
