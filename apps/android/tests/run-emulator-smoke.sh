#!/usr/bin/env bash
set -Eeuo pipefail

OUTPUT="${SMOKE_OUTPUT:-/tmp/fcarena-smoke}"
APP_ID="in.fcarena.app.debug"
ACTIVITY="${APP_ID}/in.fcarena.app.MainActivity"
MAX_ATTEMPTS="${ANDROID_SMOKE_MAX_ATTEMPTS:-3}"

mkdir -p "$OUTPUT"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "FC Arena Android smoke attempt $attempt/$MAX_ATTEMPTS"

  rm -f "$OUTPUT/failure.json"

  set +e
  ANDROID_SMOKE=1 SMOKE_OUTPUT="$OUTPUT" node apps/android/tests/smoke.mjs
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    echo "FC_ARENA_ANDROID_SMOKE_OK attempt=$attempt"
    exit 0
  fi

  adb logcat -d > "$OUTPUT/logcat-attempt-$attempt.txt" || true

  if grep -E 'FATAL EXCEPTION|ANR in in\.fcarena|Render process.*crash' "$OUTPUT/logcat-attempt-$attempt.txt" >/dev/null 2>&1; then
    echo "Android crash/ANR/renderer crash detected; refusing to retry a real app failure." >&2
    exit "$status"
  fi

  if [[ -f "$OUTPUT/failure.json" ]] &&
     grep -F 'Target page, context or browser has been closed' "$OUTPUT/failure.json" >/dev/null 2>&1 &&
     [[ "$attempt" -lt "$MAX_ATTEMPTS" ]]; then
    mv "$OUTPUT/failure.json" "$OUTPUT/failure-attempt-$attempt.json"
    echo "WebView DevTools transport disconnected without an app crash; retrying the smoke harness."

    adb shell am force-stop "$APP_ID" || true
    adb shell am start -W -n "$ACTIVITY" >/dev/null
    sleep 3
    continue
  fi

  exit "$status"
done

echo "Android smoke exhausted retry budget." >&2
exit 1
