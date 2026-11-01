from collections.abc import Iterator
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

_pool: ConnectionPool | None = None


def open_pool(url: str) -> None:
    global _pool
    # prepare_threshold=None keeps us compatible with Supabase's transaction pooler.
    _pool = ConnectionPool(
        url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row, "prepare_threshold": None},
        open=True,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency: one transaction per request (commit on success, rollback on error)."""
    assert _pool is not None, "database pool not opened"
    with _pool.connection() as conn:
        yield conn


def migrate(url: str) -> list[str]:
    """Apply pending SQL files from migrations/ in name order."""
    applied: list[str] = []
    with psycopg.connect(url, autocommit=False) as conn:
        conn.execute(
            "create table if not exists schema_migrations"
            " (name text primary key, applied_at timestamptz not null default now())"
        )
        done = {r[0] for r in conn.execute("select name from schema_migrations")}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in done:
                continue
            conn.execute(path.read_text())
            conn.execute("insert into schema_migrations (name) values (%s)", (path.name,))
            applied.append(path.name)
        conn.commit()
    return applied


if __name__ == "__main__":
    from app.config import get_settings

    for name in migrate(get_settings().database_url):
        print("applied", name)
