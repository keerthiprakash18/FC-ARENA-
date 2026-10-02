#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="\${FC_ARENA_REPO_ROOT:-/opt/fcarena}"
SYSTEMD_DIR="/etc/systemd/system"

fail() {
  echo "FC_ARENA_OPS_INSTALL_FAIL: $*" >&2
  exit 1
}

[[ "$(id -u)" == "0" ]] || fail "run this installer as root"
[[ -d "$REPO_ROOT/ops" ]] || fail "ops directory not found under $REPO_ROOT"
[[ -f "$REPO_ROOT/docker-compose.prod.yml" ]] || fail "missing $REPO_ROOT/docker-compose.prod.yml"

chmod 0755 \
  "$REPO_ROOT/ops/monitor/health-check.sh" \
  "$REPO_ROOT/ops/backup/postgres-backup.sh" \
  "$REPO_ROOT/ops/backup/postgres-restore-verify.sh"

install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-health.service" "$SYSTEMD_DIR/fcarena-health.service"
install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-health.timer" "$SYSTEMD_DIR/fcarena-health.timer"
install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-backup.service" "$SYSTEMD_DIR/fcarena-backup.service"
install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-backup.timer" "$SYSTEMD_DIR/fcarena-backup.timer"
install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-restore-verify.service" "$SYSTEMD_DIR/fcarena-restore-verify.service"
install -m 0644 "$REPO_ROOT/ops/systemd/fcarena-restore-verify.timer" "$SYSTEMD_DIR/fcarena-restore-verify.timer"

systemctl daemon-reload

echo "Running pre-enable health check..."
"$REPO_ROOT/ops/monitor/health-check.sh"

echo "Creating and validating first backup..."
"$REPO_ROOT/ops/backup/postgres-backup.sh"

echo "Restoring latest backup into an isolated temporary PostgreSQL container..."
"$REPO_ROOT/ops/backup/postgres-restore-verify.sh"

systemctl enable --now fcarena-health.timer
systemctl enable --now fcarena-backup.timer
systemctl enable --now fcarena-restore-verify.timer

echo "FC_ARENA_OPS_INSTALL_OK"
systemctl list-timers --all \
  fcarena-health.timer \
  fcarena-backup.timer \
  fcarena-restore-verify.timer
