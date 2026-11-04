"""Database rules: unchangeable records and upgrades of older database files."""

import os
import sqlite3

import pytest

from tests.helpers import publish_new


def test_originals_and_snapshots_are_immutable(client, admin):
    sid = publish_new(client, admin)
    lid = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]
    # Autocommit mode + close, so a blocked write never leaves a lock behind for later tests.
    db = sqlite3.connect(os.environ["DATABASE_PATH"], isolation_level=None)
    try:
        for sql in (
            "update submissions set seller_phone = 'x'",
            "delete from submissions",
            f"update published_versions set snapshot = '{{}}' where listing_id = '{lid}'",
        ):
            with pytest.raises(sqlite3.IntegrityError):
                db.execute(sql)
    finally:
        db.close()


def test_old_database_upgrades_to_allow_commercial(tmp_path):
    import sqlite3

    from app.core import migrations as dbmod

    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    # A version-4 database: no 'commercial' and no documentation-help column yet.
    old_schema = (
        dbmod.SCHEMA.replace("'house', 'land', 'commercial'", "'house', 'land'")
        .replace(
            "    wants_doc_help      integer not null default 0,"
            "  -- seller asked for documentation assistance (paid)\n",
            "",
        )
        .replace("    wants_doc_help, consent_version, consent_at", "    consent_version, consent_at")
    )
    conn.executescript(old_schema)
    conn.execute("pragma user_version = 4")
    conn.execute(
        "insert into submissions (id, number, device_hash, seller_name, seller_phone, property_type, land_area_cents,"
        " location, description, expected_price, negotiable, documents_available, consent_version)"
        " values ('s1', 1001, 'd', 'A', '+919000000000', 'land', 5, 'X', '', 100000, 0, 0, 'v')"
    )
    conn.commit()
    conn.close()

    settings = dbmod.get_settings()
    original = settings.database_path
    settings.database_path = str(path)
    try:
        dbmod.init_db()
    finally:
        settings.database_path = original
    conn = sqlite3.connect(path)
    assert conn.execute("pragma user_version").fetchone()[0] == dbmod.SCHEMA_VERSION
    assert conn.execute("select count(*) from submissions").fetchone()[0] == 1  # data kept
    conn.execute("update submissions set status = 'listed'")  # still allowed
    conn.execute(
        "insert into submissions (id, number, device_hash, seller_name, seller_phone, property_type, land_area_cents,"
        " location, description, expected_price, negotiable, documents_available, consent_version)"
        " values ('s2', 1002, 'd', 'B', '+919000000001', 'commercial', 5, 'Y', '', 100000, 0, 0, 'v')"
    )
