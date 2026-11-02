"""SQLite storage: one file, schema created on startup."""

import json
import logging
import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.config import get_settings

NOW = "(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"

SCHEMA = f"""
create table if not exists submissions (
    id                  text primary key,
    number              integer not null unique,  -- the one property number (#1001), shared by everyone
    device_hash         text not null,
    seller_name         text not null,
    seller_phone        text not null,
    property_type       text not null check (property_type in ('house', 'land', 'commercial')),
    land_area_cents     real not null check (land_area_cents > 0),
    location            text not null,  -- area name (public), e.g. "Puliyoor"
    area_lat            real,           -- area centre from the place suggestion
    area_lng            real,
    address             text not null default '',  -- full address: private, for LandFinder only
    description         text not null,
    expected_price      integer not null check (expected_price > 0),
    negotiable          integer not null,
    documents_available integer not null,
    documents_note      text not null default '',
    consent_version     text not null,
    consent_at          text not null default {NOW},
    created_at          text not null default {NOW},
    status              text not null default 'received'
        check (status in ('received', 'under_review', 'listed', 'sold', 'withdrawn', 'rejected')),
    status_note         text,
    status_updated_at   text not null default {NOW}
);
create index if not exists submissions_device on submissions (device_hash);

create table if not exists photos (
    id            text primary key,
    submission_id text not null references submissions (id),
    path          text not null,
    position      integer not null
);

create table if not exists listings (
    id                  text primary key,
    number              integer not null unique,
    submission_id       text not null unique references submissions (id),
    state               text not null default 'draft' check (state in ('draft', 'published', 'sold', 'withdrawn')),
    title               text not null,
    property_type       text not null check (property_type in ('house', 'land', 'commercial')),
    land_area_cents     real not null,
    location            text not null,
    description         text not null,
    price               integer not null,
    negotiable          integer not null,
    documents_available integer not null,
    documents_note      text not null default '',
    photo_ids           text not null default '[]',
    lat                 real,  -- area centre (e.g. middle of Puliyoor)
    lng                 real,
    public_lat          real,  -- the area's "flag": centre snapped to a ~1 km grid; used only for radius search
    public_lng          real,
    confirmed_price     integer,
    current_version     integer not null default 0,
    published_at        text,
    sold_at             text,
    created_at          text not null default {NOW},
    updated_at          text not null default {NOW}
);

create table if not exists published_versions (
    listing_id   text not null references listings (id),
    version      integer not null,
    snapshot     text not null,
    published_at text not null default {NOW},
    primary key (listing_id, version)
);

create table if not exists visit_requests (
    id              text primary key,
    listing_id      text not null references listings (id),
    name            text not null,
    phone           text not null,
    preferred_time  text not null default '',
    budget          text not null default '',
    status          text not null default 'new'
        check (status in ('new', 'contacted', 'scheduled', 'done', 'cancelled')),
    admin_notes     text not null default '',
    created_at      text not null default {NOW},
    updated_at      text not null default {NOW}
);

-- The seller's original submission never changes (only its workflow status).
create trigger if not exists submissions_immutable
before update of number, device_hash, seller_name, seller_phone, property_type, land_area_cents, location,
    area_lat, area_lng, address, description, expected_price, negotiable, documents_available, documents_note,
    consent_version, consent_at
on submissions begin select raise(abort, 'submission original fields are immutable'); end;

create trigger if not exists submissions_no_delete
before delete on submissions begin select raise(abort, 'submissions are immutable'); end;

-- Published snapshots never change.
create trigger if not exists published_versions_no_update
before update on published_versions begin select raise(abort, 'published versions are immutable'); end;

create trigger if not exists published_versions_no_delete
before delete on published_versions begin select raise(abort, 'published versions are immutable'); end;
"""

BOOL_FIELDS = {"negotiable", "documents_available"}


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    return conn


# Bump when SCHEMA changes in a way old database files can't use.
SCHEMA_VERSION = 5

# Small in-place upgrades from older versions (no data lost).
UPGRADES = {
    3: [f"alter table listings add column {c} real" for c in ("lat", "lng", "public_lat", "public_lng")],
    4: [
        "alter table submissions add column area_lat real",
        "alter table submissions add column area_lng real",
        "alter table submissions add column address text not null default ''",
        "drop trigger if exists submissions_immutable",  # recreated below with the new columns
        # Old blurred spots -> grid flags (0.01 degree squares, ~1.1 km)
        "update listings set public_lat = cast(lat / 0.01 as integer) * 0.01 + 0.005,"
        " public_lng = cast(lng / 0.01 as integer) * 0.01 + 0.005 where lat is not null",
    ],
}
OLDEST_UPGRADABLE = 2


def _allow_commercial(conn: sqlite3.Connection) -> None:
    """Widen the property_type check to include 'commercial'.

    Relaxing a CHECK doesn't change stored data, so SQLite allows editing the schema text in place.
    """
    old = "check (property_type in ('house', 'land'))"
    new = "check (property_type in ('house', 'land', 'commercial'))"
    version = conn.execute("pragma schema_version").fetchone()[0]
    conn.execute("pragma writable_schema = on")
    conn.execute(
        "update sqlite_master set sql = replace(sql, ?, ?)"
        " where type = 'table' and name in ('submissions', 'listings')",
        (old, new),
    )
    conn.execute(f"pragma schema_version = {version + 1}")
    conn.execute("pragma writable_schema = off")


UPGRADES[5] = [_allow_commercial]

log = logging.getLogger("nilayam")


def init_db() -> None:
    """Create the database. An older prototype database is set aside (renamed) and a fresh one created."""
    path = Path(get_settings().database_path)
    if path.exists():
        conn = sqlite3.connect(path)
        version = conn.execute("pragma user_version").fetchone()[0]
        has_tables = conn.execute("select count(*) from sqlite_master where type = 'table'").fetchone()[0] > 0
        conn.close()
        if has_tables and OLDEST_UPGRADABLE <= version < SCHEMA_VERSION:
            conn = sqlite3.connect(path)
            for v in range(version + 1, SCHEMA_VERSION + 1):
                for step in UPGRADES.get(v, []):
                    step(conn) if callable(step) else conn.execute(step)
                conn.execute(f"pragma user_version = {v}")
            conn.commit()
            conn.close()
            log.warning("Database upgraded to version %s.", SCHEMA_VERSION)
        elif has_tables and version < SCHEMA_VERSION:
            backup = path.with_name(f"{path.stem}-old-{datetime.now():%Y%m%d-%H%M%S}{path.suffix}")
            for suffix in ("", "-wal", "-shm"):
                f = Path(str(path) + suffix)
                if f.exists():
                    f.rename(Path(str(backup) + suffix))
            log.warning("Old prototype database moved to %s; starting with a fresh one.", backup.name)

    conn = connect()
    conn.execute("pragma journal_mode = wal")
    conn.executescript(SCHEMA)
    conn.execute(f"pragma user_version = {SCHEMA_VERSION}")
    conn.close()


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
