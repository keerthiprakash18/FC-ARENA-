#!/usr/bin/env bash
set -Eeuo pipefail

# Fresh Google APIs images initialize/update GMS after sys.boot_completed.
# API 34 logs show its FontsProvider dying ~2 minutes into first boot, which
# makes Android kill dependent apps. Let that boot work settle BEFORE installing
# and launching the app; never retry or relax app lifecycle assertions here.
started=$(date +%s)
stable_since=$started
previous_pid=""
while true; do
  now=$(date +%s)
  pid=$(adb shell pidof com.google.android.gms.persistent 2>/dev/null | tr -d '\r' || true)
  if [[ -z "$pid" || "$pid" != "$previous_pid" ]]; then
    stable_since=$now
    previous_pid=$pid
  fi
  if [[ -n "$pid" ]] && (( now - started >= 180 && now - stable_since >= 60 )); then
    echo "Emulator GMS ready after $((now - started))s; process stable for $((now - stable_since))s."
    exit 0
  fi
  if (( now - started >= 360 )); then
    echo "Emulator Google Play Services did not stabilize; refusing to start app tests." >&2
    exit 1
  fi
  sleep 5
done
