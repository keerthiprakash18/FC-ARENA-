#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/fcarena/docker-compose.prod.yml}"
SAMPLES="${LOAD_OBSERVER_SAMPLES:-12}"
INTERVAL_SECONDS="${LOAD_OBSERVER_INTERVAL_SECONDS:-5}"
OUTPUT="${LOAD_OBSERVER_OUTPUT:-/tmp/fcarena-load-observer.csv}"

if ! [[ "${SAMPLES}" =~ ^[0-9]+$ ]] || [ "${SAMPLES}" -lt 1 ] || [ "${SAMPLES}" -gt 720 ]; then
  echo "LOAD_OBSERVER_SAMPLES must be an integer between 1 and 720." >&2
  exit 2
fi

if ! [[ "${INTERVAL_SECONDS}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "LOAD_OBSERVER_INTERVAL_SECONDS must be a positive number." >&2
  exit 2
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 2
fi

mkdir -p "$(dirname "${OUTPUT}")"
umask 077
printf 'timestamp,load1,memory_used_pct,disk_used_pct,postgres_connections,redis_connected_clients\n' > "${OUTPUT}"

host_memory_pct() {
  awk '
    /^MemTotal:/ { total=$2 }
    /^MemAvailable:/ { available=$2 }
    END {
      if (total > 0) printf "%.1f", ((total-available)/total)*100;
      else printf "0.0";
    }
  ' /proc/meminfo
}

postgres_connections() {
  docker compose -f "${COMPOSE_FILE}" exec -T postgres sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_stat_activity;"' \
    2>/dev/null | tail -n1 | tr -d '\r' || printf 'NA'
}

redis_clients() {
  docker compose -f "${COMPOSE_FILE}" exec -T redis sh -lc \
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --no-auth-warning INFO clients | sed -n "s/^connected_clients://p" | tr -d "\r"' \
    2>/dev/null | tail -n1 || printf 'NA'
}

echo "Read-only FC Arena load observer"
echo "Output: ${OUTPUT}"
echo "Samples: ${SAMPLES}; interval: ${INTERVAL_SECONDS}s"

for ((i=1; i<=SAMPLES; i++)); do
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  load1="$(awk '{print $1}' /proc/loadavg)"
  memory_used_pct="$(host_memory_pct)"
  disk_used_pct="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
  pg_connections="$(postgres_connections)"
  redis_connected="$(redis_clients)"

  printf '%s,%s,%s,%s,%s,%s\n' \
    "${timestamp}" "${load1}" "${memory_used_pct}" "${disk_used_pct}" \
    "${pg_connections:-NA}" "${redis_connected:-NA}" >> "${OUTPUT}"

  if [ "${i}" -lt "${SAMPLES}" ]; then
    sleep "${INTERVAL_SECONDS}"
  fi
done

echo "FC_ARENA_LOAD_OBSERVER_OK output=${OUTPUT}"
