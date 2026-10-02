#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="\${FC_ARENA_COMPOSE_FILE:-/opt/fcarena/docker-compose.prod.yml}"
BACKUP_DIR="\${FC_ARENA_BACKUP_DIR:-/opt/fcarena/backups/postgres}"
RETENTION_DAYS="\${FC_ARENA_BACKUP_RETENTION_DAYS:-14}"
MIRROR_DIR="\${FC_ARENA_BACKUP_MIRROR_DIR:-}"
RCLONE_REMOTE="\${FC_ARENA_BACKUP_RCLONE_REMOTE:-}"

fail() {
  echo "FC_ARENA_BACKUP_FAIL: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || fail "retention days must be an integer"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" ps --services --status running | grep -qx "postgres" || fail "postgres service is not running"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_file="$BACKUP_DIR/fcarena_\${timestamp}.dump"
partial_file="\${final_file}.part"
checksum_file="\${final_file}.sha256"

cleanup() { rm -f "$partial_file"; }
trap cleanup EXIT

echo "Creating PostgreSQL backup: $final_file"
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$partial_file"

[[ -s "$partial_file" ]] || fail "pg_dump produced an empty backup"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore --list < "$partial_file" >/dev/null

mv "$partial_file" "$final_file"
sha256sum "$final_file" > "$checksum_file"
chmod 600 "$final_file" "$checksum_file"

if [[ -n "$MIRROR_DIR" ]]; then
  mkdir -p "$MIRROR_DIR"
  chmod 700 "$MIRROR_DIR"
  cp -p "$final_file" "$checksum_file" "$MIRROR_DIR/"
fi

if [[ -n "$RCLONE_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 || fail "rclone remote configured but rclone is not installed"
  rclone copy "$final_file" "$checksum_file" "$RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -type f \( -name 'fcarena_*.dump' -o -name 'fcarena_*.dump.sha256' \) -mtime "+$RETENTION_DAYS" -delete

echo "FC_ARENA_BACKUP_OK file=$final_file"
sha256sum "$final_file"
