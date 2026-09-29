!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

EMAIL=$(grep -E '^ACME_EMAIL=' /etc/macyou/api.env | cut -d= -f2-)
EMAIL=${EMAIL:-me@ma.cyou}
PUBLIC_IP=$(curl -4 -fsS ifconfig.me)
PRIVATE_IP=$(hostname -I | awk '{print $1}')
SECRET=$(grep -E '^TURN_SECRET=' /etc/macyou/api.env | cut -d= -f2-)
if [[ -z "$SECRET" ]]; then
  echo "missing TURN_SECRET"
  exit 1
fi

install -d -m 755 /var/www/html
cat >/etc/nginx/sites-available/turn.ma.cyou <<'NGX'
server {
    listen 80;
    listen [::]:80;
    server_name turn.ma.cyou;
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    location / {
        return 204;
    }
}
NGX
ln -sfn /etc/nginx/sites-available/turn.ma.cyou /etc/nginx/sites-enabled/turn.ma.cyou
nginx -t
systemctl reload nginx

certbot certonly --webroot -w /var/www/html -d turn.ma.cyou --agree-tos -m "$EMAIL" --non-interactive --keep-until-expiring

usermod -aG ssl-cert turnserver 2>/dev/null || true
if getent group ssl-cert >/dev/null; then
  chgrp -R ssl-cert /etc/letsencrypt/live /etc/letsencrypt/archive || true
  chmod -R g+rx /etc/letsencrypt/live /etc/letsencrypt/archive || true
  find /etc/letsencrypt/archive -name 'privkey*.pem' -exec chmod 640 {} \; || true
fi

cat >/etc/turnserver.conf <<CONF
listening-port=3478
tls-listening-port=5349
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
no-cli
min-port=49160
max-port=49400
cert=/etc/letsencrypt/live/turn.ma.cyou/fullchain.pem
pkey=/etc/letsencrypt/live/turn.ma.cyou/privkey.pem
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
CONF
chmod 640 /etc/turnserver.conf
chown root:turnserver /etc/turnserver.conf

install -d /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/coturn.sh <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
if getent group ssl-cert >/dev/null; then
  chgrp -R ssl-cert /etc/letsencrypt/live /etc/letsencrypt/archive || true
  chmod -R g+rx /etc/letsencrypt/live /etc/letsencrypt/archive || true
  find /etc/letsencrypt/archive -name 'privkey*.pem' -exec chmod 640 {} \; || true
fi
systemctl restart coturn
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/coturn.sh

systemctl restart coturn
sleep 1
systemctl is-active coturn
ss -tlnp | grep -E ':3478|:5349' || true
ss -ulnp | grep 3478 || true

python3 - <<'PY'
from pathlib import Path
path = Path('/etc/macyou/api.env')
text = path.read_text()
want = 'TURN_URLS=stun:turn.ma.cyou:3478,turn:turn.ma.cyou:3478?transport=udp,turns:turn.ma.cyou:5349?transport=tcp'
lines = []
found = False
for line in text.splitlines():
    if line.startswith('TURN_URLS='):
        lines.append(want)
        found = True
    else:
        lines.append(line)
if not found:
    lines.append(want)
path.write_text('\n'.join(lines) + '\n')
print('turn-urls-updated')
PY
systemctl restart macyou-api
sleep 1
curl -fsS http://127.0.0.1:8080/healthz
echo
echo "done public=${PUBLIC_IP} private=${PRIVATE_IP}"
