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
    assert cols == ["day", "visitor", "page", "listing_id", "source", "created_at"]  # source: a label like "ig-ad"
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


def test_where_visitors_came_from(client, admin):
    from app.buyers.requests import request_limiter
    from app.core.db import connect

    db = connect()
    with db:
        db.execute("delete from page_views")
    db.close()
    request_limiter.reset()
    for i, src in enumerate(["ig-ad", "ig-ad", "fb", "", "BAD VALUE!"]):  # five different phones
        client.post("/api/track", json={"page": "home", "source": src}, headers={"User-Agent": f"Mozilla/5.0 phone{i}"})
    body = {"name": "Ad Buyer", "phones": ["9847066666"], "property_type": "land", "came_from": "ig-ad"}
    assert client.post("/api/buyer-requests", json=body).status_code == 201
    rows = client.get("/api/admin/stats", headers=admin).json()["sources"]
    assert [r["source"] for r in rows][:5] == ["facebook", "instagram", "whatsapp", "search", "direct"]
    sources = {r["source"]: r for r in rows}
    assert sources["instagram"]["visitors"] == 2 and sources["instagram"]["requirements"] == 1  # ads count with the app
    assert sources["facebook"]["visitors"] == 1
    assert sources["direct"]["visitors"] == 2  # empty and invalid labels
    assert sources["whatsapp"]["visitors"] == 0 and sources["search"]["visitors"] == 0  # always shown
    buyer = client.get("/api/admin/buyers", params={"q": "9847066666"}, headers=admin).json()[0]
    assert buyer["came_from"] == "ig-ad"
