"""Buyer <-> property matching (admin only): which buyers a listed property may suit, and which listed properties
suit a buyer. Uses every relevant detail except names and phone numbers:

- type: what the buyer wants (or "Other" = open to any)
- area: the buyer's wanted places against the property's place and address area
- land size and budget: read from the buyer's description ("10-20 cents", "budget 25 L", "2 lakh per cent")
  against the property's size and price (per cent for land when the buyer gave a per-cent budget)
- needs: how close the buyer's description is in meaning to the property's details (when the model is on)

It only suggests; founders decide whom to call.
"""

import json
import sqlite3

from app.core.config import get_settings
from app.core.db import many
from app.semantic import store
from app.semantic.needs import read_needs
from app.semantic.text import area_match


def _lakh(rupees: float) -> str:
    return (
        f"₹{rupees / 1e7:.2f} Cr".replace(".00 ", " ")
        if rupees >= 1e7
        else f"₹{rupees / 1e5:.1f} L".replace(".0 ", " ")
    )


def _score(buyer: dict, prop: dict, meaning: float | None) -> tuple[float, list[str]] | None:
    """None when the buyer clearly doesn't fit; otherwise a score (higher = better) and the reasons."""
    if buyer["property_type"] and buyer["property_type"] != prop["property_type"]:
        return None  # wants a different type
    reasons = [f"Wants {prop['property_type']}" if buyer["property_type"] else "Open to any type"]

    in_area = bool(buyer["area"]) and (
        area_match(buyer["area"], prop["location"]) or area_match(buyer["area"], prop.get("address") or "")
    )
    if buyer["area"] and not in_area:
        return None  # a buyer who named places only fits those places
    if in_area:
        reasons.append(f"Area: {buyer['area']}")

    needs = read_needs(buyer.get("notes") or "")
    cents, price = prop.get("land_area_cents") or 0, prop.get("price") or 0

    size = None  # 1 fits, 0.5 close, None not stated
    if needs.min_cents is not None and cents:
        if needs.min_cents * 0.9 <= cents <= needs.max_cents * 1.1:
            size = 1.0
            reasons.append(f"Size fits: {cents:g} cents")
        elif needs.min_cents * 0.6 <= cents <= needs.max_cents * 1.5:
            size = 0.5
            reasons.append(f"Size close: {cents:g} cents")
        else:
            return None  # far too small or too big

    budget = None
    if needs.max_per_cent and cents and prop["property_type"] == "land":
        value, limit, label = price / cents, needs.max_per_cent, f"{_lakh(price / cents)}/cent"
    elif needs.max_price and price:
        value, limit, label = price, needs.max_price, _lakh(price)
    else:
        value = limit = None
    if limit:
        stretch = 1.3 if prop.get("negotiable") else 1.2
        if value <= limit * 1.05:
            budget = 1.0
            reasons.append(f"Within budget: {label}")
        elif value <= limit * stretch:
            budget = 0.5
            reasons.append(f"Slightly above budget: {label}")
        else:
            return None  # well over budget

    close = meaning is not None and meaning >= get_settings().match_min_score
    if close:
        reasons.append("Similar needs")
    if not (in_area or close or size or budget):
        return None

    score = (
        0.30 * in_area
        + 0.25 * (size or 0)
        + 0.25 * (budget or 0)
        + 0.15 * (meaning or 0)
        + 0.05 * (1 if buyer["property_type"] else 0.5)
    )
    return score, reasons


def _live(db: sqlite3.Connection, ids: list[str] | None = None) -> list[dict]:
    """Listed (live) properties with what buyers see, plus the private address area (admin only)."""
    sql = """select l.submission_id as id, l.id as listing_id, l.number, l.title, l.property_type, l.location,
                    l.land_area_cents, l.price, l.negotiable, s.address
             from listings l join submissions s on s.id = l.submission_id
             where l.state = 'published' and s.removed_at is null"""
    if ids is None:
        return many(db, sql)
    if not ids:
        return []
    return many(db, f"{sql} and l.submission_id in ({','.join('?' * len(ids))})", *ids)


def _cos(a, b) -> float | None:
    return float(a @ b) if a is not None and b is not None and a.shape == b.shape else None


def _matches(buyers: list[dict], bvecs: dict, prop: dict, pvec) -> list[dict]:
    results = []
    for b in buyers:
        if scored := _score(b, prop, _cos(bvecs.get(b["id"]), pvec)):
            score, reasons = scored
            results.append({**b, "score": round(score, 3), "reasons": reasons})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results


def _buyers(db: sqlite3.Connection) -> list[dict]:
    buyers = many(db, "select * from buyers")
    for b in buyers:
        b["phones"] = json.loads(b["phones"])
        b["wants_finance_help"] = bool(b["wants_finance_help"])
    return buyers


def buyers_for_property(db: sqlite3.Connection, submission_id: str, limit: int = 5) -> list[dict]:
    """Buyers a listed property may suit (empty for properties that aren't live)."""
    live = _live(db, [submission_id])
    if not live:
        return []
    pvec = store.vectors(db, "property", [submission_id]).get(submission_id)
    bvecs = store.vectors(db, "buyer") if pvec is not None else {}
    return _matches(_buyers(db), bvecs, live[0], pvec)[:limit]


def match_counts(db: sqlite3.Connection, submission_ids: list[str]) -> dict[str, int]:
    """How many buyers each listed property matches (for the Live list)."""
    live = _live(db, submission_ids)
    if not live:
        return {}
    buyers = _buyers(db)
    pvecs = store.vectors(db, "property", [p["id"] for p in live])
    bvecs = store.vectors(db, "buyer") if pvecs else {}
    return {p["id"]: len(_matches(buyers, bvecs, p, pvecs.get(p["id"]))) for p in live}


def properties_for_buyer(db: sqlite3.Connection, buyer_id: str, limit: int = 3) -> list[dict]:
    """Listed properties that may suit this buyer, best first."""
    buyers = [b for b in _buyers(db) if b["id"] == buyer_id]
    if not buyers:
        return []
    buyer = buyers[0]
    live = _live(db)
    bvec = store.vectors(db, "buyer", [buyer_id]).get(buyer_id)
    pvecs = store.vectors(db, "property", [p["id"] for p in live]) if bvec is not None else {}
    results = []
    for p in live:
        if scored := _score(buyer, p, _cos(pvecs.get(p["id"]), bvec)):
            score, reasons = scored
            results.append({
                "property_id": p["id"], "listing_id": p["listing_id"], "number": p["number"], "title": p["title"],
                "property_type": p["property_type"], "location": p["location"],
                "land_area_cents": p["land_area_cents"], "price": p["price"],
                "score": round(score, 3), "reasons": reasons,
            })  # fmt: skip
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def buyer_ids_matching(db: sqlite3.Connection, submission_ids: list[str]) -> set[str]:
    """Buyers who match any of these listed properties (used by admin cross-search)."""
    found: set[str] = set()
    for sid in submission_ids:
        found |= {b["id"] for b in buyers_for_property(db, sid, limit=50)}
    return found


def property_ids_matching(db: sqlite3.Connection, buyer_ids: list[str]) -> set[str]:
    """Listed properties that match any of these buyers (used by admin cross-search)."""
    found: set[str] = set()
    for bid in buyer_ids:
        found |= {p["property_id"] for p in properties_for_buyer(db, bid, limit=50)}
    return found
