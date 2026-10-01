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

Run once every day from the production host with a locked-down service account or systemd timer. Example cron cadence:

```text
30 2 * * * /usr/local/sbin/fcarena-backup
```

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
