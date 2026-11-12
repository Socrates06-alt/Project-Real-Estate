"""The one-time renumbering script: real properties from #1001, removed test ones out of the way."""

import sqlite3

import pytest

import renumber
from app.core.config import get_settings
from app.core.migrations import SCHEMA
from tests.helpers import publish, submit


def test_renumber_keeps_order_and_updates_public_pages(client, admin):
    db_path = get_settings().database_path
    first = get_settings().first_property_number
    with sqlite3.connect(db_path) as db:
        start = db.execute("select coalesce(max(number), 0) from submissions").fetchone()[0]
        db.execute("update submissions set removed_at = '2026-01-01T00:00:00Z'")  # earlier tests' entries
    test_one = submit(client).json()
    real = [submit(client).json() for _ in range(2)]
    with sqlite3.connect(db_path) as db:
        db.execute("update submissions set removed_at = '2026-01-01T00:00:00Z' where id = ?", (test_one["id"],))
    listing_id = publish(client, admin, real[1]["id"]).json()["listing_id"]
    assert real[0]["number"] > start

    db = sqlite3.connect(db_path)
    with db:
        renumber.apply(db, renumber.plan(db))

    assert client.get(f"/api/admin/properties/{real[0]['id']}", headers=admin).json()["number"] == first
    assert client.get(f"/api/listings/{listing_id}").json()["number"] == first + 1
    assert db.execute("select number from submissions where id = ?", (test_one["id"],)).fetchone()[0] >= 9001
    with pytest.raises(sqlite3.IntegrityError):  # the protection against changing a seller's entry is back
        db.execute("update submissions set seller_name = 'x' where id = ?", (real[0]["id"],))
    db.rollback()
    db.close()


def test_new_properties_continue_after_real_numbers_not_parked_ones(client, admin):
    db_path = get_settings().database_path
    first = submit(client).json()
    with sqlite3.connect(db_path) as db:
        db.execute("update submissions set removed_at = '2026-01-01T00:00:00Z' where id = ?", (first["id"],))
        db.execute("drop trigger if exists submissions_immutable")
        db.execute("update submissions set number = 9500 where id = ?", (first["id"],))  # parked like renumber.py does
        db.executescript(SCHEMA)  # put the protective trigger back
    nxt = submit(client).json()
    assert nxt["number"] < 9001
