#!/usr/bin/env bash
# Deploys a new macyou-api binary received on stdin. Installed to /usr/local/sbin/macyou-api-deploy (root:root, 755).
#
# Used as the forced command of the GitHub Actions deploy key in ~ma/.ssh/authorized_keys:
#   restrict,command="sudo -n /usr/local/sbin/macyou-api-deploy \"$SSH_ORIGINAL_COMMAND\"" ssh-ed25519 AAAA... github-actions macyou-api deploy
# The client cannot run anything else. The only thing it controls is the single optional argument, which must be the
# expected sha256 of the binary (64 lowercase hex chars) or empty.
#
#   ssh deploy-host "$(sha256sum api | cut -d' ' -f1)" < api
#
# Steps: receive (size cap) -> check aarch64 ELF + sha256 -> keep previous as api.prev -> install -> restart ->
# poll /healthz. If the new binary is unhealthy, api.prev is restored and restarted, and the script exits non-zero.
set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

TARGET=/opt/macyou/bin/api
PREV=/opt/macyou/bin/api.prev
UNIT=macyou-api.service
HEALTH_URL=http://127.0.0.1:8080/healthz
HEALTH_WAIT=20                       # seconds
MAX_BYTES=$((200 * 1024 * 1024))     # 200 MB
LOCK=/run/macyou-api-deploy.lock

log() { echo "[macyou-api-deploy] $*"; logger -t macyou-api-deploy -- "$*" 2>/dev/null || true; }
die() { log "ERROR: $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "must run as root (via sudo)"
[[ $# -le 1 ]] || die "expected at most one argument (the sha256)"
WANT="${1:-}"
if [[ -n "$WANT" && ! "$WANT" =~ ^[0-9a-f]{64}$ ]]; then
  die "argument must be empty or a sha256 (64 lowercase hex characters)"
fi

exec 9>"$LOCK"
flock -w 300 9 || die "another deploy is still running"

TMP="$(mktemp -d /var/tmp/macyou-api-deploy.XXXXXXXX)"
trap 'rm -rf "$TMP"' EXIT
NEW="$TMP/api"

head -c $((MAX_BYTES + 1)) > "$NEW"
SIZE="$(stat -c %s "$NEW")"
(( SIZE > 0 )) || die "no binary received on stdin"
(( SIZE <= MAX_BYTES )) || die "binary is larger than $((MAX_BYTES / 1024 / 1024)) MB"

KIND="$(file -b "$NEW")"
[[ "$KIND" == ELF\ 64-bit\ LSB\ *executable,\ ARM\ aarch64* ]] || die "not a linux/arm64 ELF executable: ${KIND:0:80}"

GOT="$(sha256sum "$NEW" | cut -d' ' -f1)"
if [[ -n "$WANT" && "$GOT" != "$WANT" ]]; then
  die "sha256 mismatch (got ${GOT:0:12}, expected ${WANT:0:12}); upload corrupted or tampered with"
fi
log "received $SIZE bytes, sha256 ${GOT:0:12}${WANT:+ (verified)}"

put() { # atomically replace TARGET with $1
  install -m 755 -o root -g root "$1" "$TARGET.new"
  mv -f "$TARGET.new" "$TARGET"
}
healthy() {
  local i
  for ((i = 0; i < HEALTH_WAIT; i++)); do
    sleep 1
    systemctl is-active --quiet "$UNIT" && curl -fsS -m 3 -o /dev/null "$HEALTH_URL" 2>/dev/null && return 0
  done
  return 1
}

if [[ -f "$TARGET" ]]; then
  install -m 755 -o root -g root "$TARGET" "$PREV"
fi
put "$NEW"
log "installed; restarting $UNIT"
systemctl restart "$UNIT"

if healthy; then
  log "deployed sha256 ${GOT:0:12}; $HEALTH_URL is healthy"
  exit 0
fi

log "ERROR: $UNIT failed the health check after ${HEALTH_WAIT}s; rolling back"
if [[ -f "$PREV" ]]; then
  put "$PREV"
  systemctl restart "$UNIT"
  if healthy; then
    log "rolled back to the previous binary; it is healthy"
  else
    log "ERROR: the previous binary is unhealthy too; check journalctl -u $UNIT"
  fi
else
  log "ERROR: no previous binary to roll back to"
fi
exit 1
