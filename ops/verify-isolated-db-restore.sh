#!/usr/bin/env bash
# GitHub Actions only: exercise a full custom-format PostgreSQL backup and
# isolated restore against disposable fcarena_test. NEVER connect to live DB.
set -Eeuo pipefail

if [[ "${CI:-}" != "true" || "${FC_ARENA_ISOLATED_RESTORE:-}" != "1" ]]; then
  echo "BLOCKED: this script requires explicit CI isolated-restore opt-in." >&2
  exit 2
fi

if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "fcarena_test" || "${PGUSER:-}" != "postgres" ]]; then
  echo "BLOCKED: source must be the disposable loopback CI database." >&2
  exit 2
fi

for program in psql pg_dump pg_restore createdb; do
  command -v "$program" >/dev/null || {
    printf 'BLOCKED: missing %s.\n' "$program" >&2
    exit 2
  }
done

: "${PGPASSWORD:?CI test password is required}"
export PGSSLMODE=disable
export PGCONNECT_TIMEOUT=5

source_db="fcarena_test"
restore_db="fcarena_restore_rehearsal"
temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$temp_dir"' EXIT

# The restore target is fixed and newly created, so this script does not
# delete or truncate any existing database, including the CI source.
if psql -X -Atq -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$restore_db'" | grep -q '^1$'; then
  echo "BLOCKED: rehearsal database already exists. Never overwrite it." >&2
  exit 2
fi

psql -X -Atq -d "$source_db" -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" |
  grep -q '^1$' || { echo "BLOCKED: schema migrations have not run." >&2; exit 2; }

echo "Starting isolated PostgreSQL custom-format backup rehearsal (no production data)."
pg_dump --no-password --format=custom --file="$temp_dir/staging.dump" -d "$source_db"
pg_restore --list "$temp_dir/staging.dump" >"$temp_dir/archive-toc.txt"

createdb --no-password "$restore_db"
pg_restore --no-password --no-owner --no-privileges --exit-on-error --dbname="$restore_db" "$temp_dir/staging.dump"

source_tables="$(psql -X -Atq -d "$source_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
restored_tables="$(psql -X -Atq -d "$restore_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"

if [[ -z "$source_tables" || "$source_tables" == 0 || "$source_tables" != "$restored_tables" ]]; then
  printf 'BLOCKED: restored schema count mismatch (source=%s, target=%s).\n' "$source_tables" "$restored_tables" >&2
  exit 1
fi

source_migrations="$(psql -X -Atq -d "$source_db" -c 'SELECT count(*) FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL')"
restored_migrations="$(psql -X -Atq -d "$restore_db" -c 'SELECT count(*) FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL')"
if [[ "$source_migrations" != "$restored_migrations" ]]; then
  echo "BLOCKED: Prisma migration history did not survive restore." >&2
  exit 1
fi

printf 'ISOLATED_RESTORE_REHEARSAL=PASS tables=%s migrations=%s\n' "$restored_tables" "$restored_migrations"
echo "NOTE: This proves disposable CI restore, not production backup restore integrity."
