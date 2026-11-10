"""Database schema, created on startup, and small in-place upgrades for older database files."""

import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from app.core.config import get_settings
from app.core.db import connect

NOW = "(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"

SCHEMA = f"""
create table if not exists submissions (
    id                  text primary key,
    number              integer not null unique,  -- the one property number (#1001), shared by everyone
    device_hash         text not null,
    seller_name         text not null,
    seller_phone        text not null,
    seller_phone2       text not null default '',  -- another number, optional
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
    wants_doc_help      integer not null default 0,  -- seller asked for documentation assistance (paid)
    wants_dev_help      integer not null default 0,  -- seller asked for property development assistance (paid)
    consent_version     text not null,
    consent_at          text not null default {NOW},
    created_at          text not null default {NOW},
    status              text not null default 'received'
        check (status in ('received', 'under_review', 'listed', 'sold', 'withdrawn', 'rejected')),
    status_note         text,
    status_updated_at   text not null default {NOW},
    removed_at          text  -- founder removed it from the lists (record kept; can be restored)
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

-- Visit counting: no cookies, no addresses stored. "visitor" is a one-way code of address + browser that
-- changes every day, so a person can be counted once per day but never followed over time.
create table if not exists page_views (
    day        text not null,  -- YYYY-MM-DD, India time
    visitor    text not null,
    page       text not null,  -- home, listing, sell, map, profile, legal, other
    listing_id text,
    created_at text not null default {NOW}
);
create index if not exists page_views_day on page_views (day);

-- Buyers the founders are helping (entered by founders; private).
create table if not exists buyers (
    id            text primary key,
    name          text not null,
    phones        text not null default '[]',  -- JSON list of phone numbers
    area          text not null default '',
    property_type text check (property_type in ('house', 'land', 'commercial')),
    notes         text not null default '',
    wants_finance_help integer not null default 0,  -- buyer needs help arranging a loan
    source        text not null default 'admin',  -- 'admin' (entered by founders) or 'website' (buyer's request)
    seen          integer not null default 1,     -- 0: a website request no founder has looked at yet
    created_at    text not null default {NOW},
    updated_at    text not null default {NOW}
);

-- Search by meaning: one saved embedding per listing (public text), property and buyer (admin only).
create table if not exists embeddings (
    kind      text not null,  -- listing, property, buyer
    ref_id    text not null,
    text_hash text not null,  -- re-embed only when the text changes
    vector    blob not null,
    primary key (kind, ref_id)
);

-- A seller's own submission never changes (only its workflow status): it is the record of what they
-- sent and agreed to. Properties a founder entered for a seller (device_hash 'admin') can be corrected.
create trigger if not exists submissions_immutable
before update of number, device_hash, seller_name, seller_phone, seller_phone2, property_type, land_area_cents,
    location, area_lat, area_lng, address, description, expected_price, negotiable, documents_available, documents_note,
    wants_doc_help, wants_dev_help, consent_version, consent_at
on submissions when old.device_hash <> 'admin'
begin select raise(abort, 'submission original fields are immutable'); end;

create trigger if not exists submissions_no_delete
before delete on submissions begin select raise(abort, 'submissions are immutable'); end;

-- Published snapshots never change.
create trigger if not exists published_versions_no_update
before update on published_versions begin select raise(abort, 'published versions are immutable'); end;

create trigger if not exists published_versions_no_delete
before delete on published_versions begin select raise(abort, 'published versions are immutable'); end;
"""


# Bump when SCHEMA changes in a way old database files can't use.
SCHEMA_VERSION = 13

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
UPGRADES[6] = [
    "alter table submissions add column wants_doc_help integer not null default 0",
    "drop trigger if exists submissions_immutable",  # recreated from SCHEMA with the new column
]

UPGRADES[7] = [
    "drop trigger if exists submissions_immutable",  # recreated from SCHEMA: admin-entered rows can be corrected
]

UPGRADES[8] = []  # page_views and buyers tables are created from SCHEMA


def _add_column(table: str, column_sql: str):
    """Upgrade step: add a column if the table exists and doesn't have it yet (a missing table is created
    from SCHEMA afterwards, already with the column)."""
    name = column_sql.split()[0]

    def step(conn: sqlite3.Connection) -> None:
        cols = [r[1] for r in conn.execute(f"pragma table_info({table})")]
        if cols and name not in cols:
            conn.execute(f"alter table {table} add column {column_sql}")

    return step


UPGRADES[9] = [
    _add_column("submissions", "wants_dev_help integer not null default 0"),
    _add_column("buyers", "wants_finance_help integer not null default 0"),
    "drop trigger if exists submissions_immutable",  # recreated from SCHEMA with the new column
]

UPGRADES[10] = []  # embeddings table is created from SCHEMA
UPGRADES[11] = [_add_column("submissions", "removed_at text")]
UPGRADES[12] = [
    _add_column("submissions", "seller_phone2 text not null default ''"),
    "drop trigger if exists submissions_immutable",  # recreated from SCHEMA with the new column
]

UPGRADES[13] = [
    _add_column("buyers", "source text not null default 'admin'"),
    _add_column("buyers", "seen integer not null default 1"),
]

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
