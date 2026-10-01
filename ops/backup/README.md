# FC Arena production backup runner

V3.3 ships a fail-closed PostgreSQL backup runner at `ops/backup/fcarena-backup.sh`.

The script:

- creates a PostgreSQL custom-format dump with `pg_dump`;
- validates the archive with `pg_restore --list`;
- writes through a temporary file and only renames after validation;
- creates SHA-256 integrity metadata;
- removes backup files older than the configured retention period;
- reports success/failure metadata to the FC Arena API;
- never sends the database dump through the API.

## Required production environment

```bash
DATABASE_URL=postgresql://...
BACKUP_REPORT_TOKEN=<long random secret>
BACKUP_DIR=/var/backups/fcarena
BACKUP_RETENTION_DAYS=14
BACKUP_REPORT_URL=https://api.fcarena.in/api/internal/ops/backups/report
BACKUP_STORAGE_KIND=LOCAL
```

The API container/process must receive the same `BACKUP_REPORT_TOKEN`. Do not commit the token or database URL.

## Recommended schedule

Run once every day from the production host with a locked-down service account or systemd timer. Example cron cadence:

```text
30 2 * * * /usr/local/sbin/fcarena-backup
```

A backup is considered healthy by the Admin System page when the latest successful report is no more than 30 hours old.

## Restore drill

At least monthly, restore the newest dump into a separate non-production PostgreSQL database and run application smoke tests. A backup that has never been restored is not considered fully verified.

Do not store production database dumps in the Git repository or GitHub Actions artifacts.
