"""One-time: renumber properties so the real ones start at #1001 (test/demo entries made the first real one #1007).

Properties still in the lists get 1001, 1002, ... in the order they were added. Properties removed from the lists
(the old test ones) move out of the way to 9001, 9002, ... The published pages, links and photos are not affected;
only the number shown changes. A copy of the database is saved first.

Preview:  sudo -u landfinder .venv/bin/python renumber.py
Apply:    sudo systemctl stop landfinder && sudo -u landfinder .venv/bin/python renumber.py --apply \
          && sudo systemctl start landfinder
"""

import json
import shutil
import sqlite3
import sys
from datetime import datetime

from app.core.config import get_settings
from app.core.migrations import SCHEMA

TRIGGERS = ("submissions_immutable", "published_versions_no_update")


def plan(db: sqlite3.Connection) -> dict[str, int]:
    first = get_settings().first_property_number
    rows = db.execute("select id, removed_at from submissions order by created_at, number").fetchall()
    kept = [r[0] for r in rows if r[1] is None]
    removed = [r[0] for r in rows if r[1] is not None]
    new = {sid: first + i for i, sid in enumerate(kept)}
    new.update({sid: 9001 + i for i, sid in enumerate(removed)})
    return new


def apply(db: sqlite3.Connection, new: dict[str, int]) -> None:
    for t in TRIGGERS:
        db.execute(f"drop trigger if exists {t}")
    # Step aside first (negative numbers) so no two properties share a number midway.
    db.execute("update submissions set number = -number")
    db.execute("update listings set number = -number")
    for sid, number in new.items():
        db.execute("update submissions set number = ? where id = ?", (number, sid))
        db.execute("update listings set number = ? where submission_id = ?", (number, sid))
    for listing_id, version, snapshot in db.execute(
        "select v.listing_id, v.version, v.snapshot from published_versions v"
    ).fetchall():
        snap = json.loads(snapshot)
        row = db.execute("select number from listings where id = ?", (listing_id,)).fetchone()
        if row and snap.get("number") != row[0]:
            snap["number"] = row[0]
            db.execute(
                "update published_versions set snapshot = ? where listing_id = ? and version = ?",
                (json.dumps(snap), listing_id, version),
            )
    db.executescript(SCHEMA)  # puts the protective triggers back


def main() -> None:
    path = get_settings().database_path
    db = sqlite3.connect(path)
    new = plan(db)
    old = dict(db.execute("select id, number from submissions").fetchall())
    names = dict(db.execute("select id, seller_name from submissions").fetchall())
    for sid, number in sorted(new.items(), key=lambda x: x[1]):
        mark = "" if old[sid] != number else "  (same)"
        print(f"#{old[sid]} -> #{number}  {names[sid]}{mark}")
    if "--apply" not in sys.argv:
        print("\nPreview only. Add --apply to change the numbers.")
        return
    backup = f"{path}.before-renumber-{datetime.now():%Y%m%d-%H%M%S}"
    shutil.copy2(path, backup)
    with db:
        apply(db, new)
    print(f"\nDone. A copy of the old database is at {backup}")


if __name__ == "__main__":
    main()
