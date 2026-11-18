#!/usr/bin/env bash
# FC ARENA read-only release retention inventory for authorized VCCLHosting.
# NEVER remove a deployment, artifact, backup, secret or systemd drop-in here.
set -Eeuo pipefail
export LC_ALL=C
host="$(hostname -s)"
[[ "$host" == "fcarena-prod" ]] || { echo "REFUSED: unexpected host $host" >&2; exit 2; }
root="/opt/fcarena-deployments"
[[ -d "$root" && ! -L "$root" ]] || { echo "REFUSED: trusted deployments root missing" >&2; exit 2; }

echo "=== FC ARENA READ-ONLY RELEASE RETENTION INVENTORY ==="
printf 'HOST=%s\n' "$host"
df -h -- "$root"
printf '\nActive production release directories (never delete):\n'
for service in fcarena-web.service fcarena-api.service; do
  active="$(systemctl show "$service" --property=ActiveState --value)"
  directory="$(systemctl show "$service" --property=WorkingDirectory --value)"
  printf '%s | %s | %s\n' "$service" "$active" "$directory"
  [[ "$active" == "active" ]] || { echo "REFUSED: service inactive $service" >&2; exit 3; }
done

printf '\nRelease directory sizes (inventory only):\n'
find "$root" -mindepth 1 -maxdepth 1 -type d -print0 |
  while IFS= read -r -d '' path; do
    [[ ! -L "$path" ]] || continue
    printf '%s | ' "$(stat -c '%y' "$path" | cut -d. -f1)"
    du -sh -- "$path" 2>/dev/null || echo "unreadable"
  done | sort

printf '\nSystemd release drop-ins that may still reference rollback packages:\n'
for service in fcarena-web.service fcarena-api.service; do
  d="/etc/systemd/system/$service.d"
  [[ -d "$d" ]] || continue
  find "$d" -maxdepth 1 -type f -name '*.conf' -printf '%p\n' | sort
done

printf '\nRetention policy: Keep all active source directories, every referenced rollback path,\n'
printf 'the last two known-good Web/API builds, and all verified backups.\n'
printf 'No automatic cleanup occurs. Inspect candidates manually before any removal.\n'
echo "RELEASE_RETENTION_AUDIT=PASS READ_ONLY"
