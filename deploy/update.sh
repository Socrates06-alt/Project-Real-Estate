#!/usr/bin/env bash
# Put the latest code from GitHub live. Takes about a minute; the site is down only for a few seconds.
# Usage: sudo /opt/landfinder/deploy/update.sh
set -euo pipefail
cd /opt/landfinder

/opt/landfinder/deploy/backup.sh               # backup first, always
sudo -u landfinder git pull --ff-only
sudo -u landfinder backend/.venv/bin/pip install -q -r backend/requirements.txt
(cd frontend && sudo -u landfinder npm ci --silent && sudo -u landfinder npm run build --silent)
cp deploy/landfinder.service /etc/systemd/system/landfinder.service
systemctl daemon-reload
systemctl restart landfinder
sleep 2
curl -fsS http://127.0.0.1:8000/api/health >/dev/null && echo "Updated and running." || { echo "Backend didn't start. See: journalctl -u landfinder -n 50"; exit 1; }
