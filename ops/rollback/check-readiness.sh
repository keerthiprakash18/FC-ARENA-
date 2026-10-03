#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${FC_ARENA_REPO_DIR:-/opt/fcarena}"
BACKUP_DIR="${FC_ARENA_BACKUP_DIR:-/opt/fcarena/backups/postgres}"
HEALTH_URL="${FC_ARENA_HEALTH_URL:-https://api.fcarena.in/api/health}"

fail() {
  echo "FC_ARENA_ROLLBACK_PREFLIGHT_FAIL: $*" >&2
  exit 1
}

warn() {
  echo "FC_ARENA_ROLLBACK_PREFLIGHT_WARN: $*" >&2
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

[[ -d "$REPO_DIR/.git" ]] || fail "repository not found: $REPO_DIR"
[[ -d "$BACKUP_DIR" ]] || fail "backup directory not found: $BACKUP_DIR"

current_sha="$(git -C "$REPO_DIR" rev-parse HEAD)"
current_branch="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
dirty_count="$(git -C "$REPO_DIR" status --porcelain --untracked-files=no | wc -l | tr -d ' ')"

echo "FC_ARENA_ROLLBACK_SOURCE branch=$current_branch sha=$current_sha"

if [[ "$dirty_count" != "0" ]]; then
  warn "tracked working tree has $dirty_count changed path(s). Do not run git reset/clean blindly; inspect before rollback."
fi

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'fcarena_*.dump' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)"
[[ -n "$latest_backup" ]] || fail "no PostgreSQL backup found"

checksum_file="${latest_backup}.sha256"
[[ -f "$checksum_file" ]] || fail "checksum missing for latest backup: $latest_backup"

(
  cd "$BACKUP_DIR"
  sha256sum -c "$(basename "$checksum_file")" >/dev/null
) || fail "latest backup checksum verification failed"

backup_epoch="$(stat -c %Y "$latest_backup")"
now_epoch="$(date +%s)"
backup_age_hours="$(( (now_epoch - backup_epoch) / 3600 ))"

if (( backup_age_hours > 30 )); then
  fail "latest verified backup is too old (${backup_age_hours}h > 30h)"
fi

health_body="$(curl --fail --silent --show-error --max-time 10 "$HEALTH_URL")" || fail "public API health check failed"
printf '%s' "$health_body" | grep -q '"status":"healthy"\|"status": "healthy"' || \
  warn "health endpoint responded but did not contain status=healthy; inspect before rollback"

echo "FC_ARENA_ROLLBACK_BACKUP_OK file=$latest_backup ageHours=$backup_age_hours"
echo "FC_ARENA_ROLLBACK_HEALTH_OK url=$HEALTH_URL"
echo "FC_ARENA_ROLLBACK_PREFLIGHT_OK"
