from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import get_settings
from app.db import get_conn
from app.ratelimit import rate_limit
from app.schemas import PropertyType, VisitRequestCreated, VisitRequestIn
from app.search import parse_query
from app.security import client_ip
from app.turnstile import verify_turnstile

router = APIRouter(tags=["public"])

_PUBLIC_STATES = {"live": ["published"], "sold": ["sold"], "all": ["published", "sold"]}


def _contact() -> dict:
    s = get_settings()
    return {"phone": s.contact_phone, "whatsapp": s.contact_whatsapp}


def _public_listing(row: dict) -> dict:
    """Only snapshot data (already sanitized at publish time) is ever returned publicly."""
    snap = row["snapshot"]
    return {
        "id": row["id"],
        "status": "sold" if row["state"] == "sold" else "live",
        "version": row["version"],
        **{
            k: snap.get(k)
            for k in (
                "number",
                "title",
                "property_type",
                "land_area_cents",
                "location",
                "description",
                "price",
                "negotiable",
                "documents_available",
                "documents_note",
                "photos",
            )
        },
        "published_at": row["published_at"],
        "sold_at": row["sold_at"],
    }


@router.get("/config")
def public_config() -> dict:
    s = get_settings()
    return {
        "contact": _contact(),
        "brokerage": {
            "seller_pct": s.seller_brokerage_pct,
            "buyer_pct": s.buyer_brokerage_pct,
            "gst_extra": True,
            "listing_fee": 0,
        },
        "consent_version": s.consent_version,
        "max_photos": s.max_photos,
        "max_photo_bytes": s.max_photo_bytes,
    }


_BASE_SELECT = """
    select l.id, l.state, l.sold_at, v.version, v.snapshot, v.published_at
    from listings l
    join published_versions v on v.listing_id = l.id and v.version = l.current_version
"""


@router.get("/listings")
def list_listings(
    q: str = Query("", max_length=200),
    type: PropertyType | None = None,
    status: Literal["live", "sold", "all"] = "live",
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0, le=10_000),
    conn: psycopg.Connection = Depends(get_conn),
    _: None = Depends(rate_limit("browse", 120, 60)),
) -> dict:
    parsed = parse_query(q)
    where = ["l.state = any(%s::listing_state[])"]
    params: list = [_PUBLIC_STATES[status]]

    ptype = type.value if type else parsed.property_type
    if ptype:
        where.append("v.snapshot->>'property_type' = %s")
        params.append(ptype)
    for cond, value in (
        ("(v.snapshot->>'price')::bigint >= %s", parsed.min_price),
        ("(v.snapshot->>'price')::bigint <= %s", parsed.max_price),
        ("(v.snapshot->>'land_area_cents')::numeric >= %s", parsed.min_cents),
        ("(v.snapshot->>'land_area_cents')::numeric <= %s", parsed.max_cents),
    ):
        if value is not None:
            where.append(cond)
            params.append(value)
    if parsed.text:
        where.append(
            "(v.search @@ plainto_tsquery('simple', %s) or word_similarity(%s, v.snapshot->>'location') > 0.5)"
        )
        params += [parsed.text, parsed.text]

    sql = (
        f"{_BASE_SELECT} where {' and '.join(where)}"
        " order by (l.state = 'published') desc, v.published_at desc limit %s offset %s"
    )
    rows = conn.execute(sql, [*params, limit + 1, offset]).fetchall()
    return {
        "items": [_public_listing(r) for r in rows[:limit]],
        "has_more": len(rows) > limit,
        "parsed": parsed.__dict__,
        "contact": _contact(),
    }


@router.get("/listings/{listing_id}")
def get_listing(listing_id: UUID, conn: psycopg.Connection = Depends(get_conn)) -> dict:
    row = conn.execute(f"{_BASE_SELECT} where l.id = %s and l.state in ('published', 'sold')", (listing_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Listing not found")
    s = get_settings()
    return {
        **_public_listing(row),
        "contact": _contact(),
        "brokerage": {"buyer_pct": s.buyer_brokerage_pct, "gst_extra": True},
    }


@router.post("/listings/{listing_id}/visit-requests", status_code=201)
def request_visit(
    listing_id: UUID,
    body: VisitRequestIn,
    request: Request,
    conn: psycopg.Connection = Depends(get_conn),
    _: None = Depends(rate_limit("visit", 10, 3600)),
) -> VisitRequestCreated:
    verify_turnstile(body.turnstile_token, client_ip(request))
    listing = conn.execute(
        "select current_version from listings where id = %s and state = 'published'", (listing_id,)
    ).fetchone()
    if listing is None:
        raise HTTPException(404, "Listing not available for visits")

    existing = conn.execute(
        "select id, status from visit_requests"
        " where listing_id = %s and phone = %s and status in ('new', 'contacted', 'scheduled')",
        (listing_id, body.phone),
    ).fetchone()
    if existing:
        return VisitRequestCreated(id=existing["id"], status=existing["status"])

    row = conn.execute(
        "insert into visit_requests (listing_id, listing_version, name, phone, preferred_time, budget, message)"
        " values (%s, %s, %s, %s, %s, %s, %s) returning id, status",
        (
            listing_id,
            listing["current_version"],
            body.name,
            body.phone,
            body.preferred_time,
            body.budget,
            body.message,
        ),
    ).fetchone()
    return VisitRequestCreated(id=row["id"], status=row["status"])
