"""SQLite access: one connection per request, and small helpers to read rows as dicts."""

import json
import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends

from app.core.config import get_settings

BOOL_FIELDS = {"negotiable", "documents_available", "wants_doc_help"}


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    return conn


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one transaction per request."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    for k in BOOL_FIELDS & d.keys():
        d[k] = bool(d[k])
    if "photo_ids" in d:
        d["photo_ids"] = json.loads(d["photo_ids"])
    if "snapshot" in d:
        d["snapshot"] = json.loads(d["snapshot"])
    return d


def one(conn: sqlite3.Connection, sql: str, *args) -> dict | None:
    return to_dict(conn.execute(sql, args).fetchone())


def many(conn: sqlite3.Connection, sql: str, *args) -> list[dict]:
    return [to_dict(r) for r in conn.execute(sql, args).fetchall()]


def now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


DB = Annotated[sqlite3.Connection, Depends(get_db)]
