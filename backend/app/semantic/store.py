"""Saved embeddings (one per listing, property and buyer) and similarity scores.

Text is only re-embedded when it changes. Listing embeddings use public text only; property and buyer
embeddings are used in admin only.
"""

import hashlib
import logging
import sqlite3

from app.core.db import many, one
from app.semantic import engine
from app.semantic.text import buyer_text, listing_text, property_text

log = logging.getLogger("nilayam")


def _hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()


def upsert(db: sqlite3.Connection, kind: str, ref_id: str, text: str) -> None:
    if not engine.ready() or not text.strip():
        return
    h = _hash(text)
    row = one(db, "select text_hash from embeddings where kind = ? and ref_id = ?", kind, ref_id)
    if row and row["text_hash"] == h:
        return
    vec = engine.embed([text], "passage")[0]
    db.execute(
        "insert or replace into embeddings (kind, ref_id, text_hash, vector) values (?, ?, ?, ?)",
        (kind, ref_id, h, vec.tobytes()),
    )


def remove(db: sqlite3.Connection, kind: str, ref_id: str) -> None:
    db.execute("delete from embeddings where kind = ? and ref_id = ?", (kind, ref_id))


def vectors(db: sqlite3.Connection, kind: str, ids: list[str] | None = None) -> dict:
    if not engine.ready():
        return {}
    np = engine.np
    if ids is None:
        rows = db.execute("select ref_id, vector from embeddings where kind = ?", (kind,)).fetchall()
    else:
        if not ids:
            return {}
        marks = ",".join("?" * len(ids))
        rows = db.execute(
            f"select ref_id, vector from embeddings where kind = ? and ref_id in ({marks})", (kind, *ids)
        ).fetchall()
    return {r[0]: np.frombuffer(r[1], dtype=np.float32) for r in rows}


def scores(db: sqlite3.Connection, kind: str, query: str, ids: list[str] | None = None) -> dict[str, float]:
    """Similarity (about -1..1, higher = closer in meaning) between the query and each saved record."""
    if not engine.ready() or not query.strip():
        return {}
    vecs = vectors(db, kind, ids)
    if not vecs:
        return {}
    q = engine.embed([query], "query")[0]
    return {ref: float(v @ q) for ref, v in vecs.items() if v.shape == q.shape}


# --- Keeping embeddings up to date ---------------------------------------------------------------


def _safe(fn):
    def run(*args):
        try:
            fn(*args)
        except Exception as exc:  # never let search indexing break saving a property or buyer
            log.warning("Semantic indexing skipped (%s)", exc)

    return run


@_safe
def refresh_listing(db: sqlite3.Connection, listing_id: str) -> None:
    row = one(
        db,
        """select v.snapshot from listings l
           join published_versions v on v.listing_id = l.id and v.version = l.current_version
           where l.id = ?""",
        listing_id,
    )
    if row:
        upsert(db, "listing", listing_id, listing_text(row["snapshot"]))


@_safe
def refresh_property(db: sqlite3.Connection, submission_id: str) -> None:
    sub = one(db, "select * from submissions where id = ?", submission_id)
    if sub:
        listing = one(db, "select * from listings where submission_id = ?", submission_id)
        upsert(db, "property", submission_id, property_text(sub, listing))


@_safe
def refresh_buyer(db: sqlite3.Connection, buyer_id: str) -> None:
    b = one(db, "select * from buyers where id = ?", buyer_id)
    if b:
        upsert(db, "buyer", buyer_id, buyer_text(b))


def backfill(db: sqlite3.Connection | None = None) -> int:
    """Embed every listing, property and buyer whose text isn't embedded yet (or changed)."""
    if not engine.ready():
        return 0
    from app.core.db import connect

    own = db is None
    conn = connect() if own else db
    try:
        before = conn.execute("select count(*) from embeddings").fetchone()[0]
        for r in many(conn, "select id from listings where state in ('published', 'sold')"):
            refresh_listing(conn, r["id"])
        for r in many(conn, "select id from submissions"):
            refresh_property(conn, r["id"])
        for r in many(conn, "select id from buyers"):
            refresh_buyer(conn, r["id"])
        if own:
            conn.commit()
        return conn.execute("select count(*) from embeddings").fetchone()[0] - before
    finally:
        if own:
            conn.close()
