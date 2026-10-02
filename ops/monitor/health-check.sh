#!/usr/bin/env bash
set -Eeuo pipefail

API_HEALTH_URL="\${FC_ARENA_HEALTH_URL:-https://api.fcarena.in/api/health}"
DISK_WARN_PERCENT="\${FC_ARENA_DISK_WARN_PERCENT:-85}"
MEMORY_WARN_PERCENT="\${FC_ARENA_MEMORY_WARN_PERCENT:-90}"

fail() {
  echo "FC_ARENA_MONITOR_FAIL: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

http_code="$(curl --silent --show-error --location --connect-timeout 5 --max-time 15 --retry 2 --retry-delay 2 --output "$body_file" --write-out "%{http_code}" "$API_HEALTH_URL")" || fail "health endpoint request failed"

[[ "$http_code" == "200" ]] || {
  cat "$body_file" >&2 || true
  fail "health endpoint returned HTTP $http_code"
}

python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)

data = payload.get("data") or {}
errors = []
if payload.get("success") is not True:
    errors.append("success != true")
if data.get("api") != "connected":
    errors.append("api != connected")
if data.get("database") != "connected":
    errors.append("database != connected")
if data.get("redis") not in {"connected", "not_configured"}:
    errors.append("redis unavailable")
if data.get("status") == "unhealthy":
    errors.append("status=unhealthy")

if errors:
    print("FC_ARENA_MONITOR_FAIL: " + "; ".join(errors), file=sys.stderr)
    print(json.dumps(payload, indent=2), file=sys.stderr)
    raise SystemExit(1)

print("FC_ARENA_API_OK", json.dumps({
    "status": data.get("status"),
    "databaseLatencyMs": (data.get("checks") or {}).get("database", {}).get("latencyMs"),
    "redisLatencyMs": (data.get("checks") or {}).get("redis", {}).get("latencyMs"),
    "uptimeSeconds": (data.get("runtime") or {}).get("uptimeSeconds"),
    "rssMb": ((data.get("runtime") or {}).get("memory") or {}).get("rssMb"),
    "release": (data.get("runtime") or {}).get("release"),
}, separators=(",", ":")))
PY

disk_percent="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
[[ "$disk_percent" =~ ^[0-9]+$ ]] || fail "unable to read root disk usage"
(( disk_percent < DISK_WARN_PERCENT )) || fail "root disk usage is \${disk_percent}% (threshold \${DISK_WARN_PERCENT}%)"

read -r memory_total_kb memory_available_kb < <(
  awk '/^MemTotal:/ { total=$2 } /^MemAvailable:/ { available=$2 } END { print total, available }' /proc/meminfo
)
[[ "\${memory_total_kb:-}" =~ ^[0-9]+$ ]] || fail "unable to read total memory"
[[ "\${memory_available_kb:-}" =~ ^[0-9]+$ ]] || fail "unable to read available memory"

memory_used_percent="$(awk -v total="$memory_total_kb" -v available="$memory_available_kb" 'BEGIN { printf "%.0f", ((total - available) / total) * 100 }')"
(( memory_used_percent < MEMORY_WARN_PERCENT )) || fail "memory usage is \${memory_used_percent}% (threshold \${MEMORY_WARN_PERCENT}%)"

echo "FC_ARENA_HOST_OK disk=\${disk_percent}% memory=\${memory_used_percent}%"
