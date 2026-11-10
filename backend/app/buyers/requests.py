"""Buyer requests from the website: "I didn't find it, here's what I need." Saved into the founders' Buyers list."""

import json
import uuid

from fastapi import APIRouter, Request

from app.buyers.schemas import BuyerRequestIn
from app.core.db import DB, many, now
from app.core.ratelimit import RateLimiter, client_ip
from app.semantic import store as semantic

router = APIRouter(prefix="/api")
request_limiter = RateLimiter(limit=10, window_seconds=3600, message="Too many requests. Please try again later.")


def _num(v: float) -> str:
    return f"{v:g}"


def _size(cents: float) -> str:
    """Acres from 100 cents (1 acre = 100 cents), like the rest of the app."""
    return f"{_num(cents / 100)} acres" if cents >= 100 else f"{_num(cents)} cents"


def _size_range(lo: float, hi: float) -> str:
    return f"{_num(lo / 100)}-{_num(hi / 100)} acres" if lo >= 100 else f"{_num(lo)}-{_num(hi)} cents"


def needs_note(body: BuyerRequestIn) -> str:
    """'5-10 cents · about 1200 sq ft · budget up to 40 lakh · 2 BHK': the format the Buyers list already uses."""
    parts = []
    lo, hi = body.min_cents, body.max_cents
    if lo and hi:
        lo, hi = min(lo, hi), max(lo, hi)
        parts.append(_size(lo) if lo == hi else _size_range(lo, hi))
    elif lo or hi:
        parts.append(f"{'at least ' if lo else 'up to '}{_size(lo or hi)}")
    if body.sqft:
        parts.append(f"about {_num(body.sqft)} sq ft")
    if body.budget_lakh:
        parts.append(f"budget up to {_num(body.budget_lakh)} lakh")
    if body.note:
        parts.append(body.note)
    return " · ".join(parts)


@router.post("/buyer-requests", status_code=201)
def request_property(body: BuyerRequestIn, request: Request, db: DB) -> dict:
    request_limiter.hit(client_ip(request))
    phones = list(dict.fromkeys(body.phones))
    values = (body.name, json.dumps(phones), body.area, body.property_type, needs_note(body), body.wants_finance_help)
    # The same person asking again (any same phone): update their request instead of adding a second one.
    mine = [
        b
        for b in many(db, "select id, phones from buyers where source = 'website'")
        if set(json.loads(b["phones"])) & set(phones)
    ]
    if mine:
        buyer_id = mine[0]["id"]
        db.execute(
            "update buyers set name = ?, phones = ?, area = ?, property_type = ?, notes = ?, wants_finance_help = ?,"
            " seen = 0, updated_at = ?"
            " where id = ?",
            (*values, now(), buyer_id),
        )
    else:
        buyer_id = str(uuid.uuid4())
        db.execute(
            "insert into buyers (id, name, phones, area, property_type, notes, wants_finance_help, source, seen)"
            " values (?, ?, ?, ?, ?, ?, ?, 'website', 0)",
            (buyer_id, *values),
        )
    semantic.refresh_buyer(db, buyer_id)
    return {"ok": True}
