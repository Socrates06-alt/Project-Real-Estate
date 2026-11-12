"""Private visit counting: no cookies, no outside services, no stored addresses.

Each view stores the day, the page, and a one-way "visitor" code made from the address and browser plus a
secret and the date. The code changes every day, so a person is counted once per day but can't be followed
across days, and the address can't be recovered from it.
"""

import hashlib
import sqlite3
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.db import many, one

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


# Where people came from, in five simple groups (ads count with their app).
MAIN_SOURCES = ("facebook", "instagram", "whatsapp", "search", "direct")
_GROUP = {"fb": "facebook", "fb-ad": "facebook", "ig": "instagram", "ig-ad": "instagram", "whatsapp": "whatsapp",
          "search": "search", "google": "search", "": "direct"}  # fmt: skip


def source_group(src: str) -> str:
    return _GROUP.get(src or "", "other")


def tracking_started(db: sqlite3.Connection) -> str | None:
    """When visitor sources started being recorded: the first visit that has one."""
    return one(db, "select min(created_at) as at from page_views where source != ''")["at"]


def by_source(db: sqlite3.Connection, since: str) -> list[dict]:
    """Last 30 days by where people came from: Facebook, Instagram, WhatsApp, Search, Direct (always shown), then
    Other and Before tracking (visits from before sources were recorded) only if there are any."""
    start = tracking_started(db) or "9999"  # nothing tracked yet: every visit so far is from before
    groups = (*MAIN_SOURCES, "other", "before")
    rows: dict[str, dict] = {g: {"source": g, "visitors": 0, "requirements": 0, "visits": 0} for g in groups}

    def row(src: str, at: str) -> dict:
        return rows["before" if not src and at < start else source_group(src)]

    visitors = """select source, early, sum(n) as visitors from (
                      select day, source, created_at < ? as early, count(distinct visitor) as n
                      from page_views where day >= ? group by day, source, early
                  ) group by source, early"""
    for r in many(db, visitors, start, since):
        row(r["source"], "" if r["early"] else "~")["visitors"] += r["visitors"]  # "": before, "~": after
    for r in many(
        db,
        "select came_from, created_at from buyers where source = 'website' and created_at >= ?",
        since,
    ):
        row(r["came_from"], r["created_at"])["requirements"] += 1
    for r in many(db, "select came_from, created_at from visit_requests where created_at >= ?", since):
        row(r["came_from"], r["created_at"])["visits"] += 1
    extra = [
        rows[g] for g in ("other", "before") if rows[g]["visitors"] or rows[g]["requirements"] or rows[g]["visits"]
    ]
    return [rows[g] for g in MAIN_SOURCES] + extra


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
