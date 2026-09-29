!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq coturn
PUBLIC_IP=$(curl -4 -fsS ifconfig.me)
PRIVATE_IP=$(hostname -I | awk '{print $1}')
SECRET=$(grep -E '^TURN_SECRET=' /etc/macyou/api.env | cut -d= -f2-)
if [[ -z "$SECRET" ]]; then
  echo "missing TURN_SECRET"
  exit 1
fi
install -d -m 755 /var/lib/macyou/acme
cat >/etc/turnserver.conf <<CONF
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${SECRET}
realm=turn.ma.cyou
server-name=turn.ma.cyou
listening-ip=0.0.0.0
relay-ip=${PRIVATE_IP}
external-ip=${PUBLIC_IP}/${PRIVATE_IP}
total-quota=100
stale-nonce=600
no-multicast-peers
no-tls
no-dtls
no-cli
min-port=49160
max-port=49400
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
CONF
chmod 640 /etc/turnserver.conf
if getent group turnserver >/dev/null; then
  chown root:turnserver /etc/turnserver.conf
else
  chown root:root /etc/turnserver.conf
fi
if [[ -f /etc/default/coturn ]]; then
  if grep -q '^TURNSERVER_ENABLED=' /etc/default/coturn; then
    sed -i 's/^TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  elif grep -q '^#TURNSERVER_ENABLED=' /etc/default/coturn; then
    sed -i 's/^#TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  else
    echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
  fi
fi
systemctl enable coturn
systemctl restart coturn
sleep 1
systemctl is-active coturn
ss -ulnp | grep -E '3478|4916' || true
ss -tlnp | grep 3478 || true
echo "public=${PUBLIC_IP} private=${PRIVATE_IP}"
