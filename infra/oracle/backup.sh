#!/usr/bin/env bash
set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="/var/backups/macyou/macyou-${stamp}.sql.zst"
sudo -u postgres pg_dump macyou | zstd -q -o "$out"
find /var/backups/macyou -name 'macyou-*.sql.zst' -mtime +14 -delete
echo "wrote $out"
echo "restore: zstd -dc $out | sudo -u postgres psql macyou"
