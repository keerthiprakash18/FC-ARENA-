#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${RECOVERY_DATABASE_URL:?RECOVERY_DATABASE_URL is required}"
: "${FC_ARENA_RESTORE_CONFIRM:?FC_ARENA_RESTORE_CONFIRM is required}"

if [ "$FC_ARENA_RESTORE_CONFIRM" != "VERIFY_ON_RECOVERY_DATABASE" ]; then
  echo "Refusing restore. Set FC_ARENA_RESTORE_CONFIRM=VERIFY_ON_RECOVERY_DATABASE." >&2
  exit 1
fi

for tool in gpg pg_restore psql sha256sum mktemp; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Required restore verification tool is missing: $tool" >&2
    exit 1
  }
done

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file does not exist: $BACKUP_FILE" >&2
  exit 1
fi

DATABASE_URL_NO_QUERY="${RECOVERY_DATABASE_URL%%\?*}"
RECOVERY_DATABASE_NAME="${DATABASE_URL_NO_QUERY##*/}"

case "$RECOVERY_DATABASE_NAME" in
  *restore*|*recovery*|*verify*)
    ;;
  *)
    echo "Refusing restore: recovery database name must contain restore, recovery, or verify." >&2
    exit 1
    ;;
esac

CHECKSUM_FILE="${BACKUP_SHA256_FILE:-${BACKUP_FILE}.sha256}"

if [ -f "$CHECKSUM_FILE" ]; then
  (
    cd "$(dirname "$BACKUP_FILE")"
    sha256sum --check "$(basename "$CHECKSUM_FILE")"
  )
else
  echo "Checksum sidecar not found; refusing unverified restore: $CHECKSUM_FILE" >&2
  exit 1
fi

RAW_FILE="$(mktemp "${TMPDIR:-/tmp}/fcarena-restore-XXXXXX.dump")"

cleanup() {
  rm -f "$RAW_FILE"
}
trap cleanup EXIT

echo "Decrypting FC Arena backup for recovery verification..."
gpg --batch --yes --output "$RAW_FILE" --decrypt "$BACKUP_FILE"

echo "Validating PostgreSQL archive..."
pg_restore --list "$RAW_FILE" >/dev/null

echo "Resetting recovery-only public schema..."
psql "$RECOVERY_DATABASE_URL" -v ON_ERROR_STOP=1   -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "Restoring archive into recovery-only database..."
pg_restore   --exit-on-error   --no-owner   --no-acl   --dbname="$RECOVERY_DATABASE_URL"   "$RAW_FILE"

TABLE_COUNT="$(
  psql "$RECOVERY_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc     "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"

EXPECTED_MIN_TABLES="${EXPECTED_MIN_TABLES:-1}"

if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$TABLE_COUNT" -lt "$EXPECTED_MIN_TABLES" ]; then
  echo "Restore verification failed: expected at least $EXPECTED_MIN_TABLES public tables, found $TABLE_COUNT." >&2
  exit 1
fi

echo "FC Arena restore verification passed."
echo "Recovery database: $RECOVERY_DATABASE_NAME"
echo "Public tables restored: $TABLE_COUNT"
