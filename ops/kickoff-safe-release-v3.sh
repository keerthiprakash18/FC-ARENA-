#!/usr/bin/env bash
# FC ARENA KICKOFF group editor VPS release, preserving the live dirty source tree.
# Requires prior verified source archive. Never alters production PostgreSQL or Docker volumes.
set -Eeuo pipefail
umask 077

LIVE=/opt/fcarena
FEATURE_REF=fix/kickoff-balanced-groups-edit-20261108
FEATURE_SHA=043411b7b3420578d479f63f2e6e9041c5d0edac
BASE_SHA=b0a365144636d561d93711cb380275113e30609e
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFETY=/root/fcarena-safety
STAGE="/opt/fcarena-deployments/kickoff-groupfix-$STAMP"
BACKUP="$SAFETY/kickoff-release-$STAMP"
SOURCE_LIST="$BACKUP/changed-sources.z"
SOURCE_ORIG="$BACKUP/original-sources"
PATCH="$BACKUP/kickoff.patch"

[[ "$EUID" -eq 0 ]] || { echo 'ERROR: run as root on fcarena-prod'; exit 1; }
[[ "$(hostname -s)" == fcarena-prod ]] || { echo 'ERROR: wrong host; expected fcarena-prod'; exit 1; }
[[ -d "$LIVE/.git" ]] || { echo 'ERROR: /opt/fcarena is not the expected Git checkout'; exit 1; }
for bin in git rsync node npm sha256sum systemctl curl docker flock; do command -v "$bin" >/dev/null || { echo "ERROR: missing $bin"; exit 1; }; done
systemctl is-active --quiet fcarena-api.service || { echo 'ERROR: production API is not active'; exit 1; }
systemctl is-active --quiet fcarena-web.service || { echo 'ERROR: production web is not active'; exit 1; }

mkdir -p "$BACKUP"
exec > >(tee -a "$BACKUP/deploy.log") 2>&1
exec 9>/run/lock/fcarena-kickoff-release.lock
flock -n 9 || { echo 'ERROR: another KICKOFF release is running'; exit 1; }

BACKUP_ARCHIVE="$(find "$SAFETY" -maxdepth 1 -type f -name 'source-*.tar.gz' | sort -r | head -n1)"
[[ -n "$BACKUP_ARCHIVE" && -s "$BACKUP_ARCHIVE" ]] || { echo 'ERROR: verified source archive missing'; exit 1; }
[[ -s "$BACKUP_ARCHIVE.sha256" ]] || { echo 'ERROR: source checksum sidecar missing'; exit 1; }
sha256sum -c "$BACKUP_ARCHIVE.sha256"

# Two built outputs and one temporary staging tree need several GB of room.
FREE_KB="$(df -Pk "$LIVE" | awk 'NR==2 {print $4}')"
(( FREE_KB > 8 * 1024 * 1024 )) || { echo 'ERROR: less than 8 GB free; aborting'; exit 1; }

# Retest latest PostgreSQL archive ONLY in the independent temporary Docker container.
# This is neither a production restore nor a migration. Fail closed if recovery is unproven.
echo '== Restorable backup preflight =='
if ! systemctl start fcarena-restore-verify.service; then
  echo 'First isolated restore test failed; one retry after 5 seconds.'
  sleep 5
  systemctl reset-failed fcarena-restore-verify.service || true
  systemctl start fcarena-restore-verify.service || {
    echo 'ERROR: backup restore verification failed twice. Nothing deployed.'
    journalctl -u fcarena-restore-verify.service -n 15 --no-pager -l || true
    exit 1
  }
fi

echo '== Make an isolated working copy; live directory stays intact =='
mkdir -p "$STAGE"
chmod 700 "$STAGE"
rsync -a --exclude='/storage/' --exclude='/backups/' \
  --exclude='/apps/api/dist/' --exclude='/apps/web/.next/' \
  --exclude='/apps/api/tsconfig.build.tsbuildinfo' \
  "$LIVE/" "$STAGE/"
# Some modules may resolve media paths at build time: provide read-only-ish links in staging.
ln -s "$LIVE/storage" "$STAGE/storage"
ln -s "$LIVE/backups" "$STAGE/backups"

# Fetch only the exact, already-CI-tested PR head; don't pull/merge/change main.
echo '== Fetch KICKOFF fix =='
git -C "$STAGE" fetch --no-tags --depth=100 origin "$FEATURE_REF"
FETCHED="$(git -C "$STAGE" rev-parse FETCH_HEAD)"
[[ "$FETCHED" == "$FEATURE_SHA" ]] || { echo "ERROR: feature branch moved: $FETCHED"; exit 1; }
git -C "$STAGE" cat-file -e "${BASE_SHA}^{commit}" || { echo 'ERROR: CI base commit unavailable'; exit 1; }

git -C "$STAGE" diff --binary "$BASE_SHA" "$FEATURE_SHA" -- \
  apps/api/src/tournaments \
  'apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx' \
  'apps/web/src/app/tournaments/[tournamentId]/wizard/groups/page.tsx' > "$PATCH"
[[ -s "$PATCH" ]] || { echo 'ERROR: patch empty'; exit 1; }

echo '== Merge PR changes with the actual VPS-only code (3-way) =='
mkdir -p "$SOURCE_ORIG" "$BACKUP/merge-tmp" "$BACKUP/conflicts"
git -C "$STAGE" diff --name-only -z "$BASE_SHA" "$FEATURE_SHA" -- \
  apps/api/src/tournaments \
  'apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx' \
  'apps/web/src/app/tournaments/[tournamentId]/wizard/groups/page.tsx' > "$SOURCE_LIST"
[[ -s "$SOURCE_LIST" ]] || { echo 'ERROR: no changed source paths found'; exit 1; }

conflict_count=0
while IFS= read -r -d '' path; do
  # Keep exact original files, not just the older 12 MB source archive.
  mkdir -p "$SOURCE_ORIG/$(dirname "$path")"
  if [[ -f "$LIVE/$path" ]]; then
    cp -a "$LIVE/$path" "$SOURCE_ORIG/$path"
  elif [[ -e "$LIVE/$path" ]]; then
    echo "ERROR: unexpected source type: $path"; exit 1
  fi
  mkdir -p "$STAGE/$(dirname "$path")" "$BACKUP/merge-tmp/$(dirname "$path")"
  base_file="$BACKUP/merge-tmp/base.tmp"
  feature_file="$BACKUP/merge-tmp/feature.tmp"
  merged_file="$BACKUP/merge-tmp/merged.tmp"

  if git -C "$STAGE" cat-file -e "$FEATURE_SHA:$path" 2>/dev/null; then
    git -C "$STAGE" show "$FEATURE_SHA:$path" > "$feature_file"
    if git -C "$STAGE" cat-file -e "$BASE_SHA:$path" 2>/dev/null; then
      git -C "$STAGE" show "$BASE_SHA:$path" > "$base_file"
      [[ -f "$STAGE/$path" ]] || { echo "ERROR: existing base file missing: $path"; exit 1; }
      if git merge-file -p --diff3 "$STAGE/$path" "$base_file" "$feature_file" > "$merged_file"; then
        cp "$merged_file" "$STAGE/$path"
      else
        # Exactly one known conflict: both independent imports must survive.
        if [[ "$path" == 'apps/api/src/tournaments/tournament-fixture-wizard.service.ts' ]] \
          && [[ "$(grep -c '^<<<<<<< ' "$merged_file" || true)" == 1 ]] \
          && [[ "$(grep -c '^||||||| ' "$merged_file" || true)" == 1 ]] \
          && [[ "$(grep -c '^=======$' "$merged_file" || true)" == 1 ]] \
          && [[ "$(grep -c '^>>>>>>> ' "$merged_file" || true)" == 1 ]] \
          && grep -Fqx "import { generateUclLeaguePhase } from './ucl-engine.js';" "$merged_file" \
          && grep -Fqx "import { assertBalancedGroups } from './group-balance.js';" "$merged_file"
        then
          sed -e '/^<<<<<<< /d' -e '/^||||||| /d' -e '/^=======$/d' -e '/^>>>>>>> /d' "$merged_file" > "$STAGE/$path"
          echo 'RESOLVED_SAFE_IMPORT_COLLISION: kept UCL + group-balance imports'
        else
          mkdir -p "$BACKUP/conflicts/$(dirname "$path")"
          cp "$merged_file" "$BACKUP/conflicts/$path"
          echo "MERGE_CONFLICT: $path"
          conflict_count=$((conflict_count + 1))
        fi
      fi
    else
      if [[ -e "$STAGE/$path" ]]; then
        if ! cmp -s "$STAGE/$path" "$feature_file"; then
          echo "MERGE_CONFLICT: new feature file already exists: $path"
          conflict_count=$((conflict_count + 1))
        fi
      else
        cp "$feature_file" "$STAGE/$path"
      fi
    fi
  else
    echo "ERROR: unexpected deleted source file: $path"
    exit 1
  fi
done < "$SOURCE_LIST"

if (( conflict_count > 0 )); then
  echo "STOP: $conflict_count conflicts require review. No live files changed."
  echo "Conflicts: $BACKUP/conflicts"
  echo "Staging: $STAGE"
  exit 20
fi

echo '== Build integrated live+KICKOFF source in staging =='
(cd "$STAGE" && npm run build:api && npm run build:web)
[[ -s "$STAGE/apps/api/dist/main.js" ]] || { echo 'ERROR: API build output not present'; exit 1; }
[[ -s "$STAGE/apps/web/.next/BUILD_ID" ]] || { echo 'ERROR: web build output not present'; exit 1; }

# Prepare compiled artifacts while live services are still up.
NEW_API="$LIVE/apps/api/.dist-kickoff-$STAMP"
NEW_WEB="$LIVE/apps/web/.next-kickoff-$STAMP"
mkdir -p "$NEW_API" "$NEW_WEB"
rsync -a "$STAGE/apps/api/dist/" "$NEW_API/"
rsync -a "$STAGE/apps/web/.next/" "$NEW_WEB/"
# Builds created by root with umask 077 must be readable by their service accounts.
chown -R "fcarena-api:$(id -gn fcarena-api)" "$NEW_API"
chown -R "fcarena-web:$(id -gn fcarena-web)" "$NEW_WEB"
chmod -R u+rwX,go+rX "$NEW_API" "$NEW_WEB"

SOURCE_PATCHED=0
STOPPED=0
OLD_API_STORED=0
OLD_WEB_STORED=0
NEW_API_MOVED=0
NEW_WEB_MOVED=0
rollback() {
  local error_code=$?
  trap - ERR INT TERM
  echo "ERROR: release failed (code $error_code); initiating rollback."
  if [[ "$STOPPED" == 1 || "$OLD_API_STORED" == 1 || "$OLD_WEB_STORED" == 1 ]]; then
    systemctl stop fcarena-web.service fcarena-api.service || true
    if [[ "$NEW_WEB_MOVED" == 1 ]]; then mv "$LIVE/apps/web/.next" "$BACKUP/failed-web-next" || true; fi
    if [[ "$OLD_WEB_STORED" == 1 ]]; then mv "$BACKUP/old-web-next" "$LIVE/apps/web/.next" || true; fi
    if [[ "$NEW_API_MOVED" == 1 ]]; then mv "$LIVE/apps/api/dist" "$BACKUP/failed-api-dist" || true; fi
    if [[ "$OLD_API_STORED" == 1 ]]; then mv "$BACKUP/old-api-dist" "$LIVE/apps/api/dist" || true; fi
  fi
  if [[ "$SOURCE_PATCHED" == 1 ]]; then
    while IFS= read -r -d '' path; do
      if [[ -f "$SOURCE_ORIG/$path" ]]; then
        mkdir -p "$LIVE/$(dirname "$path")"
        cp -a "$SOURCE_ORIG/$path" "$LIVE/$path" || true
      else
        rm -f "$LIVE/$path" || true
      fi
    done < "$SOURCE_LIST"
    echo 'Original VPS sources restored from per-release snapshots.'
  fi
  systemctl start fcarena-api.service fcarena-web.service || true
  echo "Rollback attempted; check systemctl status and $BACKUP/deploy.log"
  exit "$error_code"
}
trap rollback ERR INT TERM

# Final conflict check in case an independent task modified live files while staging built.
echo '== Final source fingerprint check before promotion =='
while IFS= read -r -d '' path; do
  if [[ -f "$SOURCE_ORIG/$path" ]]; then
    if ! cmp -s "$SOURCE_ORIG/$path" "$LIVE/$path"; then
      echo "ERROR: source changed during staging: $path"
      exit 21
    fi
  elif [[ -e "$LIVE/$path" ]]; then
    echo "ERROR: new source created while staging: $path"
    exit 21
  fi
done < "$SOURCE_LIST"

echo '== Promote tested source and compiled artifacts =='
SOURCE_PATCHED=1
while IFS= read -r -d '' path; do
  mkdir -p "$LIVE/$(dirname "$path")"
  cp -a "$STAGE/$path" "$LIVE/$path"
done < "$SOURCE_LIST"

echo '== Swap tested build outputs; keep old assets for rollback =='
systemctl stop fcarena-web.service fcarena-api.service
STOPPED=1
mv "$LIVE/apps/api/dist" "$BACKUP/old-api-dist"
OLD_API_STORED=1
mv "$NEW_API" "$LIVE/apps/api/dist"
NEW_API_MOVED=1
mv "$LIVE/apps/web/.next" "$BACKUP/old-web-next"
OLD_WEB_STORED=1
mv "$NEW_WEB" "$LIVE/apps/web/.next"
NEW_WEB_MOVED=1
systemctl start fcarena-api.service fcarena-web.service

# Service and HTTP health; rollback if either component fails.
for service in fcarena-api.service fcarena-web.service; do
  systemctl is-active --quiet "$service"
done
curl --fail --silent --show-error --retry 12 --retry-delay 2 --retry-all-errors --max-time 15 \
  http://127.0.0.1:4000/api/health -o "$BACKUP/api-health.json"
grep -q '"success":true' "$BACKUP/api-health.json" || { echo 'API health payload was not successful'; false; }
curl --fail --silent --show-error --location --retry 12 --retry-delay 2 --retry-all-errors --max-time 15 \
  http://127.0.0.1:3000/ -o /dev/null

echo 'DEPLOYED_OK: KICKOFF group editor and balance guards now running on VCCL VPS (3-way merged).'
echo "Rollback artifacts: $BACKUP"
echo "Integrated staging (retained): $STAGE"
echo 'IMPORTANT: Production groups remain unchanged until authorized admin clicks Rebalance Groups.'
trap - ERR INT TERM
