#!/usr/bin/env bash
# Disposable GitHub Actions rehearsal only: tested candidate -> previous
# snapshot -> tested candidate. NO production SSH, services, data, or secrets.
set -Eeuo pipefail
if [[ "${CI:-}" != "true" || "${FC_ARENA_ROLLBACK_REHEARSAL:-}" != "1" ]]; then
  echo "BLOCKED: isolated CI opt-in required." >&2
  exit 2
fi
if [[ ! -d .git || -d /opt/fcarena/.git && "$PWD" == /opt/fcarena* ]]; then
  echo "BLOCKED: require disposable CI checkout, never the production source." >&2
  exit 2
fi
command -v git >/dev/null
command -v tar >/dev/null
command -v sha256sum >/dev/null
command -v mktemp >/dev/null

# HEAD^ is CI's pre-change first parent or the previous branch commit. This
# validates source archive mechanics, not that a production rollback is safe.
git rev-parse --verify HEAD^ >/dev/null
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/candidate" "$work/previous" "$work/switched"
git archive --format=tar HEAD > "$work/candidate.tar"
git archive --format=tar HEAD^ > "$work/previous.tar"
sha256sum "$work/candidate.tar" "$work/previous.tar" > "$work/checksums.txt"
sha256sum -c "$work/checksums.txt" >/dev/null
tar -xf "$work/candidate.tar" -C "$work/candidate"
tar -xf "$work/previous.tar" -C "$work/previous"
test -f "$work/candidate/package.json"
test -f "$work/previous/package.json"

# Simulate deployment and rollback by switching only temporary source trees.
cp -a "$work/candidate/." "$work/switched/"
cmp "$work/switched/package.json" "$work/candidate/package.json"
rm -rf -- "$work/switched"
mkdir "$work/switched"
cp -a "$work/previous/." "$work/switched/"
cmp "$work/switched/package.json" "$work/previous/package.json"
test -f "$work/switched/apps/api/prisma/schema.prisma"
test -f "$work/switched/apps/web/src/app/layout.tsx"

# Confirm the candidate remains usable after a full source rollback rehearsal.
mkdir "$work/switched-next"
cp -a "$work/candidate/." "$work/switched-next/"
cmp "$work/switched-next/apps/api/prisma/schema.prisma" "$work/candidate/apps/api/prisma/schema.prisma"

echo "ISOLATED_SOURCE_ROLLBACK_REHEARSAL=PASS"
echo "NOTE: No VPS services, migrations, live data, smoke checks, or on-server rollback performed."
