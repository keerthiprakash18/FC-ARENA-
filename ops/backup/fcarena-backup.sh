#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/fcarena}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_REPORTING_ENABLED="${BACKUP_REPORTING_ENABLED:-true}"
BACKUP_REPORT_URL="${BACKUP_REPORT_URL:-https://api.fcarena.in/api/internal/ops/backups/report}"
BACKUP_REPORT_TOKEN="${BACKUP_REPORT_TOKEN:-}"
BACKUP_REMOTE_DEST="${BACKUP_REMOTE_DEST:-}"
BACKUP_REQUIRE_REMOTE="${BACKUP_REQUIRE_REMOTE:-false}"
BACKUP_STORAGE_KIND="${BACKUP_STORAGE_KIND:-LOCAL_ENCRYPTED}"

for tool in pg_dump pg_restore gpg curl sha256sum stat date hostname awk find; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Required backup tool is missing: $tool" >&2
    exit 1
  }
done

case "$BACKUP_REPORTING_ENABLED" in
  true|false) ;;
  *)
    echo "BACKUP_REPORTING_ENABLED must be true or false." >&2
    exit 1
    ;;
esac

case "$BACKUP_REQUIRE_REMOTE" in
  true|false) ;;
  *)
    echo "BACKUP_REQUIRE_REMOTE must be true or false." >&2
    exit 1
    ;;
esac

if [ "$BACKUP_REPORTING_ENABLED" = "true" ] && [ -z "$BACKUP_REPORT_TOKEN" ]; then
  echo "BACKUP_REPORT_TOKEN is required when backup reporting is enabled." >&2
  exit 1
fi

if [ "$BACKUP_REQUIRE_REMOTE" = "true" ] && [ -z "$BACKUP_REMOTE_DEST" ]; then
  echo "BACKUP_REMOTE_DEST is required when BACKUP_REQUIRE_REMOTE=true." >&2
  exit 1
fi

if [ -n "$BACKUP_REMOTE_DEST" ]; then
  command -v rclone >/dev/null 2>&1 || {
    echo "rclone is required when BACKUP_REMOTE_DEST is configured." >&2
    exit 1
  }
fi

if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [ "$BACKUP_RETENTION_DAYS" -lt 1 ]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi

case "$BACKUP_DIR" in
  ""|"/"|"/tmp")
    echo "Unsafe BACKUP_DIR: $BACKUP_DIR" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
HOST="$(hostname | tr -cd 'A-Za-z0-9._-' | cut -c1-120)"
FINAL_FILE="$BACKUP_DIR/fcarena-${STAMP}.dump.gpg"
CHECKSUM_FILE="${FINAL_FILE}.sha256"
RAW_FILE="$BACKUP_DIR/.fcarena-${STAMP}.dump.partial"
TEMP_FILE="${FINAL_FILE}.partial"
FINISHED=0

report_failure() {
  local exit_code=$?

  if [ "$FINISHED" -eq 1 ]; then
    return
  fi

  rm -f "$RAW_FILE" "$TEMP_FILE" || true

  if [ "$BACKUP_REPORTING_ENABLED" = "true" ]; then
    local completed_at
    completed_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    curl --fail --silent --show-error --max-time 15       -X POST "$BACKUP_REPORT_URL"       -H "Content-Type: application/json"       -H "X-Backup-Report-Token: $BACKUP_REPORT_TOKEN"       --data-binary "{\"status\":\"FAILED\",\"startedAt\":\"$STARTED_AT\",\"completedAt\":\"$completed_at\",\"storageKind\":\"$BACKUP_STORAGE_KIND\",\"retentionDays\":$BACKUP_RETENTION_DAYS,\"sourceHost\":\"$HOST\",\"errorMessage\":\"Backup command failed with exit code $exit_code\"}"       >/dev/null 2>&1 || true
  fi

  echo "FC Arena backup failed." >&2
}

trap report_failure EXIT

echo "Starting FC Arena encrypted PostgreSQL backup..."

pg_dump   --format=custom   --compress=9   --no-owner   --no-acl   --file="$RAW_FILE"   "$DATABASE_URL"

pg_restore --list "$RAW_FILE" >/dev/null

gpg   --batch   --yes   --trust-model always   --output "$TEMP_FILE"   --encrypt   --recipient "$BACKUP_ENCRYPTION_RECIPIENT"   "$RAW_FILE"

rm -f "$RAW_FILE"

mv "$TEMP_FILE" "$FINAL_FILE"
chmod 600 "$FINAL_FILE"

SIZE_BYTES="$(stat -c '%s' "$FINAL_FILE")"
CHECKSUM="$(sha256sum "$FINAL_FILE" | awk '{print $1}')"
printf '%s  %s\n' "$CHECKSUM" "$(basename "$FINAL_FILE")" > "$CHECKSUM_FILE"
chmod 600 "$CHECKSUM_FILE"

if [ -n "$BACKUP_REMOTE_DEST" ]; then
  REMOTE_BASE="${BACKUP_REMOTE_DEST%/}"
  REMOTE_FILE="$REMOTE_BASE/$(basename "$FINAL_FILE")"

  echo "Uploading encrypted backup to configured off-server destination..."

  rclone copyto --retries 3 --low-level-retries 10 "$FINAL_FILE" "$REMOTE_FILE"
  rclone copyto --retries 3 --low-level-retries 10 "$CHECKSUM_FILE" "${REMOTE_FILE}.sha256"

  BACKUP_STORAGE_KIND="REMOTE_ENCRYPTED"
fi

COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [ "$BACKUP_REPORTING_ENABLED" = "true" ]; then
  curl --fail --silent --show-error --max-time 20     -X POST "$BACKUP_REPORT_URL"     -H "Content-Type: application/json"     -H "X-Backup-Report-Token: $BACKUP_REPORT_TOKEN"     --data-binary "{\"status\":\"SUCCESS\",\"startedAt\":\"$STARTED_AT\",\"completedAt\":\"$COMPLETED_AT\",\"sizeBytes\":\"$SIZE_BYTES\",\"checksumSha256\":\"$CHECKSUM\",\"storageKind\":\"$BACKUP_STORAGE_KIND\",\"retentionDays\":$BACKUP_RETENTION_DAYS,\"sourceHost\":\"$HOST\"}"     >/dev/null
fi

find "$BACKUP_DIR"   -maxdepth 1   -type f   \( -name 'fcarena-*.dump.gpg' -o -name 'fcarena-*.dump.gpg.sha256' \)   -mtime "+$BACKUP_RETENTION_DAYS"   -delete

FINISHED=1
trap - EXIT

echo "FC Arena encrypted backup completed."
echo "Backup file: $FINAL_FILE"
echo "Checksum file: $CHECKSUM_FILE"
echo "SHA-256: $CHECKSUM"
echo "Size bytes: $SIZE_BYTES"
if [ -n "$BACKUP_REMOTE_DEST" ]; then
  echo "Off-server copy: completed"
fi
