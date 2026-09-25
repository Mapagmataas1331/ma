#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "run as root"; exit 1; fi
apt-get update
apt-get install -y postgresql-16 coturn ufw unattended-upgrades
id macyou >/dev/null 2>&1 || useradd --system --home /var/lib/macyou --shell /usr/sbin/nologin macyou
install -d -o macyou -g macyou -m 750 /opt/macyou/bin /etc/macyou /var/lib/macyou/mailbox /var/lib/macyou/acme /var/backups/macyou
if [[ ! -f /etc/macyou/api.env ]]; then
  install -m 600 -o root -g macyou infra/oracle/api.env.example /etc/macyou/api.env
fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='macyou'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE macyou LOGIN PASSWORD 'change-me'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='macyou'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE macyou OWNER macyou"
install -m 644 infra/oracle/macyou-api.service /etc/systemd/system/macyou-api.service
install -m 644 infra/oracle/coturn/turnserver.conf /etc/turnserver.conf
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 49160:49400/udp
ufw --force enable
systemctl enable --now postgresql coturn
echo "Place the API binary at /opt/macyou/bin/api, edit /etc/macyou/api.env, then systemctl enable --now macyou-api"
