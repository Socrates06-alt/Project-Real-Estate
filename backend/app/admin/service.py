"""Admin business rules: property groups, publishing a listing, ending a listing.

Routes call these; keeping the rules here makes them easy to test and reuse (e.g. a future bulk import).
"""

import json
import sqlite3
import uuid
from typing import Literal

from fastapi import HTTPException

from app.admin import lifecycle
from app.admin.schemas import PublishIn
from app.core.config import get_settings
from app.core.db import many, now, one
from app.listings import geo
from app.semantic import store as semantic
from app.submissions import photos

# Groups and allowed moves live in app/admin/lifecycle.py (the property state machine).
GROUPS = lifecycle.GROUPS
ListGroup = Literal["new", "live", "sold", "not_listed"]  # the lists founders can open

# Listing fields buyers see (and the admin edits). Seller identity is never one of them.
PUBLIC_FIELDS = (
    "title", "property_type", "land_area_cents", "location", "description",
    "price", "negotiable", "documents_available", "documents_note", "photo_ids",
)  # fmt: skip


group_of = lifecycle.status_group
group_of_sub = lifecycle.group_of


def set_status(db: sqlite3.Connection, submission_id: str, status: str, note: str | None = None) -> None:
    db.execute(
        "update submissions set status = ?, status_note = coalesce(?, status_note), status_updated_at = ? where id = ?",
        (status, note, now(), submission_id),
    )


def get_submission(db: sqlite3.Connection, submission_id: str) -> dict:
    sub = one(db, "select * from submissions where id = ?", submission_id)
    if sub is None:
        raise HTTPException(404, "Property not found")
    return sub


def reference_price(db: sqlite3.Connection, sub: dict, listing: dict | None) -> int:
    """Last published price, or the seller's expected price before the first publish."""
    if listing and listing["current_version"]:
        last = one(
            db, "select snapshot from published_versions where listing_id = ? and version = ?",
            listing["id"], listing["current_version"],
        )  # fmt: skip
        return last["snapshot"]["price"]
    return sub["expected_price"]


def publish(db: sqlite3.Connection, submission_id: str, body: PublishIn) -> dict:
    """One step: create/update the listing and publish a new, unchangeable snapshot."""
    sub = get_submission(db, submission_id)
    lifecycle.require(sub, "publish")
    valid_photos = {
        p["id"]: p["path"] for p in many(db, "select id, path from photos where submission_id = ?", submission_id)
    }
    if not set(body.photo_ids) <= valid_photos.keys() or len(set(body.photo_ids)) != len(body.photo_ids):
        raise HTTPException(422, "Invalid photos")

    listing = one(db, "select * from listings where submission_id = ?", submission_id)
    reference = reference_price(db, sub, listing)
    change = abs(body.price - reference) * 100 / reference
    already_confirmed = listing is not None and listing["confirmed_price"] == body.price
    if change > get_settings().material_price_change_pct and not (body.seller_confirmed or already_confirmed):
        raise HTTPException(409, "PRICE_NEEDS_SELLER_CONFIRMATION")

    values = body.model_dump(include=set(PUBLIC_FIELDS))
    values["photo_ids"] = json.dumps(body.photo_ids)
    if listing is None:
        listing_id = str(uuid.uuid4())
        number = sub["number"]  # the listing keeps the property's number from submission
        db.execute(
            f"insert into listings (id, number, submission_id, {', '.join(values)})"
            f" values (?, ?, ?, {', '.join('?' * len(values))})",
            (listing_id, number, submission_id, *values.values()),
        )
    else:
        listing_id, number = listing["id"], listing["number"]
        sets = ", ".join(f"{k} = ?" for k in values)  # column names from PUBLIC_FIELDS only
        db.execute(f"update listings set {sets}, updated_at = ? where id = ?", (*values.values(), now(), listing_id))
    if body.seller_confirmed:
        db.execute("update listings set confirmed_price = ? where id = ?", (body.price, listing_id))

    # Area centre -> its grid "flag", used only for buyers' radius search (never sent to buyers).
    public_lat, public_lng = geo.flag(body.lat, body.lng) if body.lat is not None else (None, None)
    db.execute(
        "update listings set lat = ?, lng = ?, public_lat = ?, public_lng = ? where id = ?",
        (body.lat, body.lng, public_lat, public_lng, listing_id),
    )

    snapshot = {
        "number": number,
        **body.model_dump(include=set(PUBLIC_FIELDS) - {"photo_ids"}),
        "photos": [photos.publish_copy(valid_photos[pid], listing_id, pid) for pid in body.photo_ids],
    }
    version = (listing["current_version"] if listing else 0) + 1
    db.execute(
        "insert into published_versions (listing_id, version, snapshot) values (?, ?, ?)",
        (listing_id, version, json.dumps(snapshot)),
    )
    db.execute(
        "update listings set state = 'published', current_version = ?, published_at = ?, updated_at = ? where id = ?",
        (version, now(), now(), listing_id),
    )
    set_status(db, submission_id, "listed")
    semantic.refresh_listing(db, listing_id)
    semantic.refresh_property(db, submission_id)
    return {"id": submission_id, "listing_id": listing_id, "number": number, "group": "live"}


def end_listing(db: sqlite3.Connection, submission_id: str, state: str, status: str) -> dict:
    """Sold or taken down: the listing stops being live."""
    sub = get_submission(db, submission_id)
    lifecycle.require(sub, "sold" if state == "sold" else "take_down")
    db.execute(
        "update listings set state = ?, sold_at = case when ? = 'sold' then ? else sold_at end, updated_at = ?"
        " where submission_id = ?",
        (state, state, now(), now(), submission_id),
    )
    set_status(db, submission_id, status)
    return {"id": submission_id, "group": group_of(status)}


def remove(db: sqlite3.Connection, submission_id: str) -> dict:
    """Take a not-listed or sold property off all lists and the public site. The record is kept (the seller's
    agreement, and for sold ones the brokerage record) and it can be restored; search by number still finds it."""
    sub = get_submission(db, submission_id)
    if sub["removed_at"]:
        return {"id": submission_id, "group": "removed"}
    lifecycle.require(sub, "remove")
    db.execute("update submissions set removed_at = ? where id = ?", (now(), submission_id))
    db.execute(
        "update listings set state = 'withdrawn', updated_at = ? where submission_id = ? and state = 'sold'",
        (now(), submission_id),
    )
    return {"id": submission_id, "group": "removed"}


def restore(db: sqlite3.Connection, submission_id: str) -> dict:
    sub = get_submission(db, submission_id)
    if not lifecycle.can(sub, "restore"):  # not removed: nothing to do
        return {"id": submission_id, "group": group_of(sub["status"])}
    db.execute("update submissions set removed_at = null where id = ?", (submission_id,))
    if sub["status"] == "sold":  # back on the public site as sold
        db.execute(
            "update listings set state = 'sold', updated_at = ? where submission_id = ? and sold_at is not null",
            (now(), submission_id),
        )
    return {"id": submission_id, "group": group_of(sub["status"])}
