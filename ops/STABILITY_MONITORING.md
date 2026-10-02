# FC Arena Stability & Monitoring — Steps 1–4

## 1. Crash and ANR monitoring

Android production already uses Firebase Crashlytics.

Verified code safeguards:
- Google Services + Crashlytics Gradle plugins are enabled for release builds.
- Firebase Crashlytics dependency is included through the Firebase BoM.
- Crashlytics collection is enabled in AndroidManifest.xml.
- ArenaApplication initializes monitoring fail-open so telemetry initialization cannot block app startup.
- version name, version code and build type are attached as Crashlytics custom keys.
- push-notification auto-init remains opt-in and independent of Crashlytics.

Operational acceptance still requires one controlled test crash on a non-public/test install and confirmation that it appears in Firebase Crashlytics. Do not deliberately crash the public production build.

## 2. Backend and host monitoring

There are two independent layers.

- External: .github/workflows/production-health.yml checks https://api.fcarena.in/api/health every 15 minutes.
- VPS-local: ops/monitor/health-check.sh checks the API plus root disk and memory every 5 minutes.

The API health endpoint already checks PostgreSQL and Redis and exposes latency, process memory, uptime and release SHA.

Default VPS warning thresholds:
- disk: 85%
- memory: 90%

Logs:
~~~bash
systemctl status fcarena-health.timer
journalctl -u fcarena-health.service -n 100 --no-pager
~~~

## 3. Automatic PostgreSQL backup

ops/backup/postgres-backup.sh:
- uses the running Compose postgres service;
- never stops the production database;
- creates PostgreSQL custom-format dumps;
- writes to a temporary .part file first;
- rejects empty output;
- validates each dump with pg_restore --list before accepting it;
- creates a SHA-256 checksum;
- stores artifacts with restrictive permissions;
- retains 14 days by default.

Default backup location:
~~~text
/opt/fcarena/backups/postgres
~~~

Optional second local/mounted copy:
~~~bash
export FC_ARENA_BACKUP_MIRROR_DIR=/mnt/backup/fcarena
~~~

Optional off-server rclone destination:
~~~bash
export FC_ARENA_BACKUP_RCLONE_REMOTE='remote:fcarena/postgres'
~~~

A second/off-server copy is recommended because a backup stored only on the same VPS does not protect against total VPS loss.

## 4. Automatic restore verification

ops/backup/postgres-restore-verify.sh:
- verifies SHA-256 when available;
- launches a temporary isolated postgres:17 container;
- restores the latest backup with no production connection;
- verifies restored public tables exist;
- runs a SQL health query;
- deletes the temporary container on success or failure.

It never writes to the production database.

## One-time VPS activation

After this change is merged and deployed to /opt/fcarena:

~~~bash
cd /opt/fcarena
git checkout main
git pull origin main
sudo bash ops/install-stability-ops.sh
~~~

The installer is fail-closed: it runs the health check, creates a real backup and proves that backup can restore before enabling timers. If any prerequisite fails, the timers are not enabled.

Verify:
~~~bash
systemctl list-timers --all | grep fcarena
ls -lh /opt/fcarena/backups/postgres
journalctl -u fcarena-backup.service -n 50 --no-pager
journalctl -u fcarena-restore-verify.service -n 50 --no-pager
~~~

Expected timers:
- health: every 5 minutes
- backup: daily around 03:17 with randomized delay
- restore verification: weekly Sunday around 04:30 with randomized delay

## Safety rules

- Never restore a backup directly over production as a test.
- Never commit PostgreSQL passwords, keystores or private Firebase Admin credentials.
- Keep at least one backup copy outside the primary VPS for disaster recovery.
- Treat any failed restore verification as a production-readiness blocker until resolved.
