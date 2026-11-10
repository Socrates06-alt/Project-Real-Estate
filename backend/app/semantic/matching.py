"""Buyer <-> property matching (admin only): suggests whom to call when a property comes in, and which live
properties suit a buyer. Uses the type they want, the area they want, and how close their notes are in meaning
to the property (when the meaning model is on). It only suggests; founders decide.
"""

import json
import sqlite3

from app.core.config import get_settings
from app.core.db import many, one
from app.semantic import store
from app.semantic.text import area_match


def _score(buyer: dict, ptype: str, location: str, meaning: float | None) -> tuple[float, list[str]] | None:
    """None when the buyer clearly doesn't fit; otherwise a score (higher = better) and the reasons."""
    if buyer["property_type"] and buyer["property_type"] != ptype:
        return None  # wants a different type
    in_area = bool(buyer["area"]) and area_match(buyer["area"], location)
    if buyer["area"] and not in_area:
        return None  # area comes first in property: a buyer who named places only fits those places
    close = meaning is not None and meaning >= get_settings().match_min_score
    if not (in_area or close):
        return None
    reasons = [("Wants " + ptype) if buyer["property_type"] else "Open to any type"]
    if in_area:
        reasons.append(f"Area: {buyer['area']}")
    if close:
        reasons.append("Similar needs")
    score = 0.55 * (meaning or 0) + 0.35 * in_area + 0.10 * (1 if buyer["property_type"] else 0.5)
    return score, reasons


def buyers_for_property(db: sqlite3.Connection, submission_id: str, limit: int = 5) -> list[dict]:
    sub = one(db, "select * from submissions where id = ?", submission_id)
    if sub is None:
        return []
    listing = one(db, "select * from listings where submission_id = ?", submission_id)
    src = listing or sub
    pvec = store.vectors(db, "property", [submission_id]).get(submission_id)
    bvecs = store.vectors(db, "buyer") if pvec is not None else {}
    results = []
    for b in many(db, "select * from buyers"):
        v = bvecs.get(b["id"])
        meaning = float(v @ pvec) if v is not None and pvec is not None and v.shape == pvec.shape else None
        if scored := _score(b, src["property_type"], src["location"], meaning):
            score, reasons = scored
            b["phones"] = json.loads(b["phones"])
            b["wants_finance_help"] = bool(b["wants_finance_help"])
            results.append({**b, "score": round(score, 3), "reasons": reasons})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def properties_for_buyer(db: sqlite3.Connection, buyer_id: str, limit: int = 3) -> list[dict]:
    buyer = one(db, "select * from buyers where id = ?", buyer_id)
    if buyer is None:
        return []
    live = many(
        db,
        """select l.id as listing_id, l.submission_id as property_id, l.number, l.property_type, l.location,
                  l.land_area_cents, l.price, l.title
           from listings l where l.state = 'published'""",
    )
    bvec = store.vectors(db, "buyer", [buyer_id]).get(buyer_id)
    pvecs = store.vectors(db, "property", [r["property_id"] for r in live]) if bvec is not None else {}
    results = []
    for p in live:
        v = pvecs.get(p["property_id"])
        meaning = float(v @ bvec) if v is not None and bvec is not None and v.shape == bvec.shape else None
        if scored := _score(buyer, p["property_type"], p["location"], meaning):
            score, reasons = scored
            results.append({**p, "score": round(score, 3), "reasons": reasons})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]
