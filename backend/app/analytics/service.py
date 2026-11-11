"""Private visit counting: no cookies, no outside services, no stored addresses.

Each view stores the day, the page, and a one-way "visitor" code made from the address and browser plus a
secret and the date. The code changes every day, so a person is counted once per day but can't be followed
across days, and the address can't be recovered from it.
"""

import hashlib
import sqlite3
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.db import many

IST = timedelta(hours=5, minutes=30)  # India time, so "today" matches the founders' day
KEEP_DAYS = 400
_BOTS = (
    "bot", "crawl", "spider", "slurp", "facebookexternalhit", "whatsapp", "telegram", "preview", "curl", "python",
    "headless", "lighthouse", "phantom", "selenium", "puppeteer", "playwright", "wget", "go-http",
)  # fmt: skip


def today() -> str:
    return (datetime.now(UTC) + IST).strftime("%Y-%m-%d")


def day_minus(day: str, n: int) -> str:
    return (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=n)).strftime("%Y-%m-%d")


def is_bot(user_agent: str) -> bool:
    ua = user_agent.lower()
    return not ua or any(b in ua for b in _BOTS)


def visitor_code(day: str, address: str, user_agent: str) -> str:
    s = get_settings()
    secret = f"landfinder-visits|{s.admin_password}|{s.admin_password_2}"
    return hashlib.sha256(f"{secret}|{day}|{address}|{user_agent}".encode()).hexdigest()[:16]


def record(
    db: sqlite3.Connection, address: str, user_agent: str, page: str, listing_id: str | None, source: str = ""
) -> None:
    if is_bot(user_agent):
        return
    day = today()
    db.execute(
        "insert into page_views (day, visitor, page, listing_id, source) values (?, ?, ?, ?, ?)",
        (day, visitor_code(day, address, user_agent), page, listing_id, source),
    )


def cleanup(db: sqlite3.Connection) -> None:
    db.execute("delete from page_views where day < ?", (day_minus(today(), KEEP_DAYS),))


def by_source(db: sqlite3.Connection, since: str) -> list[dict]:
    """Last 30 days by where people came from: visitors, requirements and visit requests, most visitors first."""
    rows: dict[str, dict] = {}

    def row(src: str) -> dict:
        return rows.setdefault(
            src or "other", {"source": src or "other", "visitors": 0, "requirements": 0, "visits": 0}
        )

    for r in many(
        db,
        """select source, sum(visitors) as visitors from (
               select day, source, count(distinct visitor) as visitors
               from page_views where day >= ? group by day, source
           ) group by source""",
        since,
    ):
        row(r["source"])["visitors"] = r["visitors"]
    for r in many(
        db,
        "select came_from, count(*) as n from buyers where source = 'website' and created_at >= ? group by came_from",
        since,
    ):
        row(r["came_from"])["requirements"] = r["n"]
    for r in many(
        db, "select came_from, count(*) as n from visit_requests where created_at >= ? group by came_from", since
    ):
        row(r["came_from"])["visits"] = r["n"]
    return sorted(rows.values(), key=lambda r: (r["source"] == "other", -r["visitors"]))


def by_month(db: sqlite3.Connection) -> list[dict]:
    """Visitors (unique per day, added up, like the other numbers) and page views for each month, newest first."""
    return many(
        db,
        """select substr(day, 1, 7) as month, sum(visitors) as visitors, sum(views) as views from (
               select day, count(distinct visitor) as visitors, count(*) as views from page_views group by day
           ) group by month order by month desc""",
    )


def stats(db: sqlite3.Connection) -> dict:
    """Visitors (unique per day, added up), page views, a 30-day series and the most-viewed properties."""
    t = today()
    since = day_minus(t, 29)
    rows = {
        r["day"]: r
        for r in many(
            db,
            "select day, count(distinct visitor) as visitors, count(*) as views from page_views"
            " where day >= ? group by day",
            since,
        )
    }
    series = []
    for i in range(29, -1, -1):
        d = day_minus(t, i)
        series.append(
            {
                "day": d,
                "visitors": rows[d]["visitors"] if d in rows else 0,
                "views": rows[d]["views"] if d in rows else 0,
            }
        )

    def visitors(last_days: int) -> int:
        return sum(p["visitors"] for p in series[-last_days:])

    top = many(
        db,
        """select v.listing_id, count(*) as views, l.number, l.submission_id as property_id,
                  json_extract(pv.snapshot, '$.title') as title, json_extract(pv.snapshot, '$.location') as location
           from page_views v
           join listings l on l.id = v.listing_id
           left join published_versions pv on pv.listing_id = l.id and pv.version = l.current_version
           where v.page = 'listing' and v.day >= ?
           group by v.listing_id order by views desc limit 5""",
        since,
    )
    return {
        "today": series[-1]["visitors"],
        "last_7_days": visitors(7),
        "last_30_days": visitors(30),
        "views_30_days": sum(p["views"] for p in series),
        "series": series,
        "months": by_month(db),
        "sources": by_source(db, since),
        "top_properties": top,
    }
