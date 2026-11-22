#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

COMPOSE_FILE="${FC_ARENA_COMPOSE_FILE:-/opt/fcarena/docker-compose.prod.yml}"
BACKUP_DIR="${FC_ARENA_BACKUP_DIR:-/opt/fcarena/backups/postgres}"
POSTGRES_IMAGE="${FC_ARENA_RESTORE_VERIFY_IMAGE:-}"
LATEST_BACKUP="${1:-}"

fail() {
  echo "FC_ARENA_RESTORE_VERIFY_FAIL: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"

if [[ -z "$LATEST_BACKUP" ]]; then
  LATEST_BACKUP="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'fcarena_*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi

[[ -n "$LATEST_BACKUP" ]] || fail "no PostgreSQL backup found in $BACKUP_DIR"
[[ -f "$LATEST_BACKUP" ]] || fail "backup not found: $LATEST_BACKUP"
[[ -s "$LATEST_BACKUP" ]] || fail "backup is empty: $LATEST_BACKUP"

checksum_file="${LATEST_BACKUP}.sha256"
[[ -f "$checksum_file" ]] || fail "backup checksum sidecar is required"
(cd "$(dirname "$LATEST_BACKUP")" && sha256sum -c "$(basename "$checksum_file")")

if [[ -z "$POSTGRES_IMAGE" ]]; then
  postgres_container="$(docker compose -f "$COMPOSE_FILE" ps -q postgres)"
  [[ -n "$postgres_container" ]] || fail "production postgres service is not running"
  POSTGRES_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$postgres_container")"
fi

[[ -n "$POSTGRES_IMAGE" ]] || fail "unable to determine PostgreSQL image"
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || fail "reviewed PostgreSQL image is not installed"

container="fc-arena-restore-verify-$$"
database="fcarena_restore_verify"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting isolated restore verification with image: $POSTGRES_IMAGE"
docker run --detach --rm --name "$container" --network none --read-only \
  --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 \
  --security-opt no-new-privileges \
  --tmpfs /var/lib/postgresql:rw,nosuid,size=1g \
  --tmpfs /var/run/postgresql:rw,nosuid,size=32m \
  --tmpfs /tmp:rw,nosuid,size=128m \
  --env PGDATA=/var/lib/postgresql/fcarena-restore-data \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB="$database" "$POSTGRES_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 40); do
  # The entrypoint's temporary initialization server accepts Unix sockets,
  # then shuts down. TCP becomes ready only on the final server.
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d "$database" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || fail "temporary PostgreSQL container did not become ready"

docker exec -i "$container" pg_restore -h 127.0.0.1 -U postgres -d "$database" --no-owner --no-privileges --exit-on-error < "$LATEST_BACKUP"

table_count="$(docker exec "$container" psql -h 127.0.0.1 -U postgres -d "$database" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
[[ "$table_count" =~ ^[0-9]+$ ]] || fail "restore verification returned an invalid table count"
(( table_count > 0 )) || fail "restored database contains no public tables"

docker exec "$container" psql -h 127.0.0.1 -U postgres -d "$database" -v ON_ERROR_STOP=1 -Atc "SELECT 1;" | grep -qx "1"

echo "FC_ARENA_RESTORE_VERIFY_OK backup=$LATEST_BACKUP image=$POSTGRES_IMAGE public_tables=$table_count"
