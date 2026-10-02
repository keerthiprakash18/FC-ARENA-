#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="\${FC_ARENA_BACKUP_DIR:-/opt/fcarena/backups/postgres}"
POSTGRES_IMAGE="\${FC_ARENA_RESTORE_VERIFY_IMAGE:-postgres:17}"
LATEST_BACKUP="\${1:-}"

fail() {
  echo "FC_ARENA_RESTORE_VERIFY_FAIL: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

if [[ -z "$LATEST_BACKUP" ]]; then
  LATEST_BACKUP="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'fcarena_*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi

[[ -n "$LATEST_BACKUP" ]] || fail "no PostgreSQL backup found in $BACKUP_DIR"
[[ -f "$LATEST_BACKUP" ]] || fail "backup not found: $LATEST_BACKUP"
[[ -s "$LATEST_BACKUP" ]] || fail "backup is empty: $LATEST_BACKUP"

checksum_file="\${LATEST_BACKUP}.sha256"
if [[ -f "$checksum_file" ]]; then
  (cd "$(dirname "$LATEST_BACKUP")" && sha256sum -c "$(basename "$checksum_file")")
fi

container="fc-arena-restore-verify-$$"
database="fcarena_restore_verify"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting isolated restore verification container: $container"
docker run --detach --rm --name "$container" --env POSTGRES_PASSWORD=restore_verify_only --env POSTGRES_DB="$database" "$POSTGRES_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 40); do
  if docker exec "$container" pg_isready -U postgres -d "$database" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || fail "temporary PostgreSQL container did not become ready"

docker exec -i "$container" pg_restore -U postgres -d "$database" --no-owner --no-privileges < "$LATEST_BACKUP"

table_count="$(docker exec "$container" psql -U postgres -d "$database" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
[[ "$table_count" =~ ^[0-9]+$ ]] || fail "restore verification returned an invalid table count"
(( table_count > 0 )) || fail "restored database contains no public tables"

docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -Atc "SELECT 1;" | grep -qx "1"

echo "FC_ARENA_RESTORE_VERIFY_OK backup=$LATEST_BACKUP public_tables=$table_count"
