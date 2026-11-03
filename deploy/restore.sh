#!/usr/bin/env bash
# Restore a backup made by backup.sh.
# Usage: sudo /opt/landfinder/deploy/restore.sh 2026-11-20_0230
set -euo pipefail

STAMP=${1:?Give the backup date, e.g. 2026-11-20_0230 (see: ls /var/backups/landfinder)}
SRC=/var/backups/landfinder
DATA=/var/lib/landfinder

test -f "$SRC/landfinder-$STAMP.db.gz" || { echo "No backup $STAMP"; exit 1; }

systemctl stop landfinder
# Keep the current data aside, just in case
mv "$DATA" "$DATA.before-restore-$(date +%Y%m%d%H%M%S)"
mkdir -p "$DATA"
gunzip -c "$SRC/landfinder-$STAMP.db.gz" > "$DATA/landfinder.db"
tar -xzf "$SRC/media-$STAMP.tar.gz" -C "$DATA"
chown -R landfinder:landfinder "$DATA"
systemctl start landfinder
echo "Restored backup $STAMP. The previous data is kept in $DATA.before-restore-*"
