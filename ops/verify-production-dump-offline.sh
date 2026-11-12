#!/usr/bin/env bash
# OPERATOR-ONLY FC ARENA disaster-recovery rehearsal.
# Reads one already existing production pg_dump custom archive ON the VPS.
# Restores it into a temporary network-disconnected Docker PostgreSQL instance.
# NEVER connects to production PostgreSQL, never uploads production data and
# never changes Git checkout, systemd services, release files or live DB.
set -Eeuo pipefail
umask 077

if [[ "${FC_ARENA_OFFLINE_RESTORE:-}" != "I_UNDERSTAND" ]]; then
  echo "BLOCKED: explicit FC_ARENA_OFFLINE_RESTORE=I_UNDERSTAND required." >&2
  exit 2
fi
if [[ "$(hostname -s)" != "fcarena-prod" ]]; then
  echo "BLOCKED: run only on the verified current fcarena-prod VPS." >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 ]]; then
  echo "BLOCKED: root-only local report and read-only production archive required." >&2
  exit 2
fi

backup_dir="/opt/fcarena/backups/postgres"
report_dir="/root/fcarena-safety"
backup="${FC_ARENA_BACKUP_FILE:-}"
if [[ -z "$backup" || "$backup" != "$backup_dir/"*.dump ||
      ! -f "$backup" || -L "$backup" || ! -f "$backup.sha256" ]]; then
  echo "BLOCKED: specify an existing non-symlink *.dump with matching *.dump.sha256 under the production backup directory." >&2
  exit 2
fi
if [[ ! -d "$report_dir" || -L "$report_dir" ]]; then
  echo "BLOCKED: private safety report directory is missing." >&2
  exit 2
fi
for exe in docker sha256sum pg_restore python3; do
  command -v "$exe" >/dev/null || { echo "BLOCKED: missing $exe." >&2; exit 2; }
done

# Production archive checksum MUST be verified before any restore attempt.
(cd "$backup_dir" && sha256sum --check --status "$(basename "$backup").sha256") || {
  echo "BLOCKED: backup checksum verification failed." >&2
  exit 1
}
# TOC parsing is safe and does not connect to a database.
pg_restore --list "$backup" >/dev/null || {
  echo "BLOCKED: invalid custom format archive." >&2
  exit 1
}

# Only an already installed image may be used: never pull unreviewed images
# automatically on production. Postgres 18 matches the server-side pg tools.
image="postgres:18"
docker image inspect "$image" >/dev/null 2>&1 || {
  echo "BLOCKED: pre-reviewed postgres:18 image is not installed." >&2
  exit 2
}

id="$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
container="fcarena-offline-restore-$id"
log="$(mktemp "$report_dir/offline-restore.XXXXXX.log")"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  # The temporary log is private and contains no restored rows.
}
trap cleanup EXIT

docker run -d --rm --name "$container" --network none --read-only \
  --security-opt no-new-privileges \
  --tmpfs /var/lib/postgresql:rw,nosuid,size=4g \
  --tmpfs /var/run/postgresql:rw,nosuid,size=32m \
  --tmpfs /tmp:rw,nosuid,size=256m \
  --env POSTGRES_HOST_AUTH_METHOD=trust "$image" > /dev/null

ready=0
for _ in $(seq 1 45); do
  if docker exec -u postgres "$container" pg_isready -q -U postgres; then
    ready=1; break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "BLOCKED: isolated PostgreSQL failed to start; inspect private log." >&2
  exit 1
fi

docker exec -u postgres "$container" createdb -U postgres fcarena_restore_rehearsal
# No network and no mount of backup or production disk inside container.
# Production rows stream via stdin to the disposable server only.
if ! docker exec -i -u postgres "$container" pg_restore \
    -U postgres -d fcarena_restore_rehearsal --no-owner --no-privileges \
    --exit-on-error < "$backup" > "$log" 2>&1; then
  echo "FAILED: isolated production dump restore. Private log retained under /root/fcarena-safety." >&2
  exit 1
fi

query() {
  docker exec -u postgres "$container" psql -X -Atq -v ON_ERROR_STOP=1 \
    -U postgres -d fcarena_restore_rehearsal -c "$1"
}
tables="$(query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
migrations="$(query 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"
users_present="$(query "SELECT to_regclass('public.users') IS NOT NULL")"
if [[ ! "$tables" =~ ^[0-9]+$ || "$tables" -lt 5 ||
      ! "$migrations" =~ ^[0-9]+$ || "$migrations" -lt 1 ||
      "$users_present" != "t" ]]; then
  echo "FAILED: restored production schema/migration sanity check." >&2
  exit 1
fi
user_count="$(query 'SELECT count(*) FROM public.users')"
if [[ ! "$user_count" =~ ^[0-9]+$ || "$user_count" -lt 1 ]]; then
  echo "FAILED: restored production user data missing." >&2
  exit 1
fi

checksum="$(sha256sum "$backup" | cut -d' ' -f1)"
export FC_ARENA_OFFLINE_BACKUP_SHA="$checksum"
export FC_ARENA_OFFLINE_TABLES="$tables"
export FC_ARENA_OFFLINE_MIGRATIONS="$migrations"
export FC_ARENA_OFFLINE_USERS="$user_count"
export FC_ARENA_OFFLINE_BACKUP_BASENAME="$(basename "$backup")"
out="$report_dir/offline-restore-$id.json"
export FC_ARENA_OFFLINE_REPORT="$out"
python3 - <<'PY'
import datetime, json, os, pathlib
report = {
    "status": "PASS",
    "mode": "offline-network-disconnected-disposable-docker",
    "verifiedAtUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "archiveName": os.environ["FC_ARENA_OFFLINE_BACKUP_BASENAME"],
    "backupSha256": os.environ["FC_ARENA_OFFLINE_BACKUP_SHA"],
    "restoredPublicTableCount": int(os.environ["FC_ARENA_OFFLINE_TABLES"]),
    "finishedMigrationCount": int(os.environ["FC_ARENA_OFFLINE_MIGRATIONS"]),
    "restoredUsers": int(os.environ["FC_ARENA_OFFLINE_USERS"]),
    "disclaimer": "No production PostgreSQL server contacted; report contains no user rows.",
}
path = pathlib.Path(os.environ["FC_ARENA_OFFLINE_REPORT"])
with path.open("x", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
    f.write("\n")
path.chmod(0o600)
PY
echo "OFFLINE_PRODUCTION_DUMP_RESTORE=PASS"
printf 'tables=%s finished_migrations=%s nonempty_users=YES\n' "$tables" "$migrations"
echo "Private 0600 JSON evidence written under /root/fcarena-safety."
echo "The disposable PostgreSQL container is deleted on exit."
