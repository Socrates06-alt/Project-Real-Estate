"""Visit counting: private, counts unique visitors per day, admin-only numbers."""

from tests.helpers import publish_new

BROWSER = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile"}


def test_visits_are_counted_privately_and_shown_to_admins(client, admin):
    from app.analytics.routes import track_limiter

    track_limiter.reset()
    sid = publish_new(client, admin)
    lid = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]
    before = client.get("/api/admin/stats", headers=admin).json()

    for page in ("home", "listing", "listing"):
        body = {"page": page, "listing_id": lid if page == "listing" else None}
        assert client.post("/api/track", json=body, headers=BROWSER).status_code == 204
    other = {"User-Agent": "Mozilla/5.0 (iPhone) Safari/18"}
    assert client.post("/api/track", json={"page": "home"}, headers=other).status_code == 204
    # Link previews and bots aren't counted.
    client.post("/api/track", json={"page": "home"}, headers={"User-Agent": "WhatsApp/2.23"})
    client.post("/api/track", json={"page": "home"}, headers={"User-Agent": "Mozilla/5.0 HeadlessChrome/130"})

    stats = client.get("/api/admin/stats", headers=admin).json()
    assert stats["today"] - before["today"] == 2  # two different visitors today
    assert stats["views_30_days"] - before["views_30_days"] == 4
    assert len(stats["series"]) == 30
    top = {t["listing_id"]: t for t in stats["top_properties"]}
    assert top[lid]["views"] >= 2 and top[lid]["property_id"] == sid

    # Nothing identifying is stored: no addresses, browsers or cookies.
    import sqlite3

    from app.core.config import get_settings

    conn = sqlite3.connect(get_settings().database_path)
    cols = [r[1] for r in conn.execute("pragma table_info(page_views)")]
    conn.close()
    assert cols == ["day", "visitor", "page", "listing_id", "created_at"]
    assert client.get("/api/admin/stats").status_code == 401


def test_track_rejects_unknown_pages(client):
    assert client.post("/api/track", json={"page": "admin"}).status_code == 422


def test_monthly_totals(client, admin):
    from app.core.db import connect

    db = connect()
    with db:
        rows = [("2026-09-01", "a"), ("2026-09-01", "a"), ("2026-09-02", "a"), ("2026-10-05", "b")]
        for day, visitor in rows:
            db.execute("insert into page_views (day, visitor, page) values (?, ?, 'home')", (day, visitor))
    months = {m["month"]: m for m in client.get("/api/admin/stats", headers=admin).json()["months"]}
    assert (months["2026-09"]["visitors"], months["2026-09"]["views"]) == (2, 3)
    assert (months["2026-10"]["visitors"], months["2026-10"]["views"]) == (1, 1)
    db.close()
