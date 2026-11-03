#!/usr/bin/env bash
# Daily backup of the database and photos. Keeps the last 14 days in /var/backups/landfinder.
# Runs from cron (see /etc/cron.d/landfinder-backup). Run by hand any time: sudo /opt/landfinder/deploy/backup.sh
set -euo pipefail

DATA=/var/lib/landfinder
DEST=/var/backups/landfinder
KEEP_DAYS=14
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$DEST"
chmod 700 "$DEST"

# Safe copy of the live database (consistent even while the app is writing)
/opt/landfinder/backend/.venv/bin/python - "$DATA/landfinder.db" "$DEST/landfinder-$STAMP.db" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1])
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PY
gzip -f "$DEST/landfinder-$STAMP.db"

# Photos (seller originals + published copies)
tar -czf "$DEST/media-$STAMP.tar.gz" -C "$DATA" media

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup done: $DEST (landfinder-$STAMP.db.gz, media-$STAMP.tar.gz)"
