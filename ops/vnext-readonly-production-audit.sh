#!/usr/bin/env bash
# FC ARENA vNext operator preflight. READ ONLY: no git pull/reset/clean,
# no service restart, no database writes, no environment-file contents.
set -Eeuo pipefail

EXPECTED_HOST="fcarena-prod"
EXPECTED_IP="45.129.87.8"
REPO="/opt/fcarena"
DB_BACKUPS="/opt/fcarena/backups/postgres"
SOURCE_BACKUPS="/root/fcarena-safety"

fail() { printf 'BLOCKED: %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s ==\n' "$*"; }

[[ "$(hostname -s)" == "$EXPECTED_HOST" ]] || fail "Not the FC ARENA production hostname."
[[ "$(ip -4 -o addr show scope global || true)" == *"$EXPECTED_IP/"* ]] ||
  fail "Expected VCCLHosting production IPv4 address is absent."
[[ -d "$REPO/.git" ]] || fail "Production checkout missing."

step "Service status (no restarts)"
for svc in fcarena-web fcarena-api nginx; do
  printf '%s: ' "$svc"
  systemctl is-active "$svc" || fail "Service not active: $svc"
done

step "Source identity (no file names or contents printed)"
cd "$REPO"
printf 'Current Git HEAD: '
git rev-parse HEAD
printf 'Modified and untracked working-tree entry count: '
git status --porcelain=v1 --untracked-files=all | wc -l
printf 'Tracked file modifications: '
git diff --name-only --no-ext-diff | wc -l
printf 'Untracked file count: '
git ls-files --others --exclude-standard | wc -l

step "Available disk space"
df -h "$REPO" | tail -1

step "Public health (safe metadata only)"
curl -fLsS --connect-timeout 10 --max-time 20   https://api.fcarena.in/api/health >/dev/null ||
  fail "API health check failed."
printf '%s\n' "API health endpoint: reachable"
http_code="$(curl -sSL --connect-timeout 10 --max-time 20 -o /dev/null -w '%{http_code}' https://fcarena.in/)"
[[ "$http_code" == "200" ]] || fail "Website returned HTTP $http_code."
printf '%s\n' "Website: HTTP 200"

step "Database backup checksum and archive format"
[[ -d "$DB_BACKUPS" ]] || fail "PostgreSQL backup directory missing."
latest="$(find "$DB_BACKUPS" -maxdepth 1 -type f -name '*.dump' -printf '%f\n' | sort | tail -1)"
[[ -n "$latest" ]] || fail "No database dump found."
[[ -f "$DB_BACKUPS/$latest.sha256" ]] || fail "Latest dump checksum missing."
(
  cd "$DB_BACKUPS"
  sha256sum --status -c "$latest.sha256"
) || fail "Latest dump checksum failed."
printf 'Backup integrity SHA256: OK (%s)\n' "$latest"
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$DB_BACKUPS/$latest" >/dev/null || fail "Backup archive list unreadable."
  printf '%s\n' "PostgreSQL custom archive TOC: readable"
else
  printf '%s\n' "PostgreSQL pg_restore: missing (isolated restore required before deployment)"
fi
[[ -d "$SOURCE_BACKUPS" ]] || fail "Source backup directory missing."
source_count="$(find "$SOURCE_BACKUPS" -maxdepth 3 -type f \
  \( -name '*.tar.gz' -o -name '*.tgz' \) | wc -l)"
printf 'Source archives found: %s\n' "$source_count"
[[ "$source_count" -gt 0 ]] || fail "No source backup archives found."

step "PREFLIGHT_READ_ONLY_OK"
printf '%s\n' "Not a deployment approval. Restore rehearsal, source reconciliation and final tests remain required."
