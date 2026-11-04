#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for LandFinder.
# Usage (on the server), after cloning the code to /opt/landfinder (see docs/DEPLOY.md step 5):
#   sudo bash /opt/landfinder/deploy/setup.sh landfinder.in
set -euo pipefail

DOMAIN=${1:?Usage: sudo bash setup.sh <domain>}
APP=/opt/landfinder
DATA=/var/lib/landfinder

echo "==> System packages"
apt-get update -q
apt-get install -y -q python3 python3-venv python3-pip git curl debian-keyring debian-archive-keyring apt-transport-https ufw

echo "==> Node.js 22 (to build the web app)"
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

echo "==> Caddy (web server with automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

echo "==> App user and folders"
id landfinder >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/landfinder --shell /usr/sbin/nologin landfinder
mkdir -p "$DATA/media" /var/log/caddy
chown -R landfinder:landfinder "$DATA"
chmod 750 "$DATA"

echo "==> Code"
test -d "$APP/.git" || { echo "Clone the code to $APP first (docs/DEPLOY.md step 5)."; exit 1; }
# The app user pulls updates with the server's read-only GitHub deploy key.
if [ -f /root/.ssh/landfinder_deploy ]; then
  install -d -m 700 -o landfinder -g landfinder /home/landfinder/.ssh
  install -m 600 -o landfinder -g landfinder /root/.ssh/landfinder_deploy /home/landfinder/.ssh/id_ed25519
  ssh-keyscan github.com 2>/dev/null > /home/landfinder/.ssh/known_hosts
  chown landfinder:landfinder /home/landfinder/.ssh/known_hosts
fi
chown -R landfinder:landfinder "$APP"
chmod 755 "$APP"

echo "==> Backend"
sudo -u landfinder python3 -m venv "$APP/backend/.venv"
sudo -u landfinder "$APP/backend/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"
ENV="$APP/backend/.env"
if [ ! -f "$ENV" ]; then
  cp "$APP/deploy/env.production.example" "$ENV"
  sed -i "s#https://example.com#https://$DOMAIN#" "$ENV"
  chown landfinder:landfinder "$ENV"
  chmod 600 "$ENV"
  echo
  echo "!! Fill in $ENV (passwords and phone numbers), then run this script again."
  echo "   sudo nano $ENV"
  exit 0
fi

echo "==> Web app (build)"
(cd "$APP/frontend" && sudo -u landfinder npm ci --silent && sudo -u landfinder npm run build --silent)

echo "==> Services"
cp "$APP/deploy/landfinder.service" /etc/systemd/system/landfinder.service
systemctl daemon-reload
systemctl enable --now landfinder
systemctl restart landfinder

sed "s/example\.com/$DOMAIN/g" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Daily backup at 2:30 am (India time)"
timedatectl set-timezone Asia/Kolkata || true
chmod +x "$APP"/deploy/*.sh
echo "30 2 * * * root $APP/deploy/backup.sh >> /var/log/landfinder-backup.log 2>&1" > /etc/cron.d/landfinder-backup

echo "==> Firewall (web + SSH only)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

sleep 2
if curl -fsS http://127.0.0.1:8000/api/health >/dev/null; then
  echo
  echo "Done. Open https://$DOMAIN  (admin: https://$DOMAIN/admin)"
else
  echo "Backend didn't start. See: sudo journalctl -u landfinder -n 50"
  exit 1
fi
