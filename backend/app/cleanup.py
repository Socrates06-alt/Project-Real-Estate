"""Nightly job: delete original photos of rejected submissions after the retention period.

Run with: python -m app.cleanup
"""

import logging

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings
from app.storage import get_storage

log = logging.getLogger("nilayam.cleanup")


def cleanup_rejected_photos() -> int:
    s = get_settings()
    storage = get_storage()
    with psycopg.connect(s.database_url, row_factory=dict_row) as conn:
        rows = conn.execute(
            """select p.id, p.bucket, p.path from listing_photos p
               join submissions sub on sub.id = p.submission_id
               where p.kind = 'original' and sub.status = 'rejected'
                 and sub.status_updated_at < now() - make_interval(days => %s)""",
            (s.rejected_photo_retention_days,),
        ).fetchall()
        for row in rows:
            storage.delete(row["bucket"], [row["path"]])
            conn.execute("delete from listing_photos where id = %s", (row["id"],))
    log.info("deleted %d rejected photos", len(rows))
    return len(rows)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cleanup_rejected_photos()
