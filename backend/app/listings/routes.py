"""Buyers: browse and search listings, and see one listing. Only published snapshots are ever shown."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.config import get_settings, public_contact
from app.core.db import DB, many, one
from app.core.ratelimit import RateLimiter, client_ip
from app.listings import geo
from app.listings.search import parse_query
from app.semantic import store as semantic
from app.semantic.text import keyword_score, words

# Normal map use is far below this; stops someone probing the map with hundreds of searches.
area_search_limiter = RateLimiter(limit=300, window_seconds=3600)

router = APIRouter(prefix="/api")


_STATES = {"live": ("published",), "sold": ("sold",), "all": ("published", "sold")}
_SNAPSHOT_FIELDS = (
    "number", "title", "property_type", "land_area_cents", "location", "description",
    "price", "negotiable", "documents_available", "documents_note", "photos",
)  # fmt: skip


def public_listing(row: dict) -> dict:
    """Only the published snapshot (already sanitized) is ever shown publicly."""
    snap = row["snapshot"]
    return {
        "id": row["id"],
        "status": "sold" if row["state"] == "sold" else "live",
        "version": row["version"],
        **{k: snap.get(k) for k in _SNAPSHOT_FIELDS},
        "published_at": row["published_at"],
        "listed_at": row["listed_at"],
        "price_reduced": row["prev_price"] is not None and snap["price"] < row["prev_price"],
        "sold_at": row["sold_at"],
    }


_LIVE_SELECT = """
    select l.id, l.state, l.sold_at, l.public_lat, l.public_lng, v.version, v.snapshot, v.published_at,
           (select min(published_at) from published_versions f where f.listing_id = l.id) as listed_at,
           (select json_extract(p.snapshot, '$.price') from published_versions p
             where p.listing_id = l.id and p.version = l.current_version - 1) as prev_price
    from listings l
    join published_versions v on v.listing_id = l.id and v.version = l.current_version
"""


def _rank_by_text(db, rows: list[dict], text: str) -> list[dict]:
    """Keep listings that match the search words (small typos allowed) or, with the meaning model, are close
    in meaning; best match first. Without the model this is plain word matching, as before."""
    s = get_settings()
    query_words = words(text)
    meaning = semantic.scores(db, "listing", text, [r["id"] for r in rows])
    kw = {}
    for r in rows:
        snap = r["snapshot"]
        kw[r["id"]] = keyword_score(query_words, f"{snap['title']} {snap['location']} {snap['description']}")
    any_word_match = any(v == 1 for v in kw.values())
    # When some listings match the words, a meaning-only match must be strong to be shown alongside.
    needed = s.semantic_strong_score if any_word_match else s.semantic_min_score
    ranked = []
    for i, r in enumerate(rows):
        m = meaning.get(r["id"])
        if kw[r["id"]] == 1 or (m is not None and m >= needed):
            ranked.append((0.7 * (m or 0) + 0.3 * kw[r["id"]] + (1 if kw[r["id"]] == 1 else 0), -i, r))
    ranked.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [r for *_, r in ranked]


@router.get("/listings")
def list_listings(
    db: DB,
    request: Request,
    q: str = Query("", max_length=200),
    type: Literal["house", "land", "commercial"] | None = None,
    status: Literal["live", "sold", "all"] = "live",
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float = Query(5, ge=0.5, le=50),
    docs: bool = False,
) -> dict:
    parsed = parse_query(q)
    states = _STATES[status]
    where = [f"l.state in ({','.join('?' * len(states))})"]
    args: list = list(states)

    if docs:
        where.append("json_extract(v.snapshot, '$.documents_available') = 1")
    if ptype := (type or parsed.property_type):
        where.append("json_extract(v.snapshot, '$.property_type') = ?")
        args.append(ptype)
    for cond, value in (
        ("json_extract(v.snapshot, '$.price') >= ?", parsed.min_price),
        ("json_extract(v.snapshot, '$.price') <= ?", parsed.max_price),
        ("json_extract(v.snapshot, '$.land_area_cents') >= ?", parsed.min_cents),
        ("json_extract(v.snapshot, '$.land_area_cents') <= ?", parsed.max_cents),
    ):
        if value is not None:
            where.append(cond)
            args.append(value)
    rows = many(
        db,
        f"{_LIVE_SELECT} where {' and '.join(where)} order by l.state = 'published' desc, v.published_at desc",
        *args,
    )
    has_text = bool(words(parsed.text))
    if has_text:
        rows = _rank_by_text(db, rows, parsed.text)
    if lat is not None and lng is not None:
        # Area search (map): a property is in if its area's flag is inside the circle.
        # Nearest area first; within an area, newest first. Locations/distances are never returned.
        area_search_limiter.hit(client_ip(request))
        near = []
        for r in rows:
            if r["public_lat"] is not None:
                d = geo.distance_km(lat, lng, r["public_lat"], r["public_lng"])
                if d <= radius_km:
                    near.append((round(d, 2), r))
        if not has_text:  # with search words, the best match stays first
            near.sort(key=lambda x: (x[1]["published_at"], x[1]["snapshot"]["number"]), reverse=True)
            near.sort(key=lambda x: x[0])  # stable: keeps newest-first inside each area
        rows = [r for _, r in near]
    items = [public_listing(r) for r in rows]
    return {
        "items": items[offset : offset + limit],
        "has_more": len(items) > offset + limit,
        "total": len(items),
        "parsed": parsed.__dict__,
        "contact": public_contact(),
    }


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str, db: DB) -> dict:
    row = one(db, f"{_LIVE_SELECT} where l.id = ? and l.state in ('published', 'sold')", listing_id)
    if row is None:
        raise HTTPException(404, "Listing not found")
    s = get_settings()
    return {
        **public_listing(row),
        "contact": public_contact(),
        "brokerage": {"buyer_pct": s.buyer_brokerage_pct, "gst_extra": True},
    }
