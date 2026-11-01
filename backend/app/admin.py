"""Admin API. Prototype auth: one password (ADMIN_PASSWORD) -> signed, expiring token."""

import hashlib
import hmac
import json
import sqlite3
import time
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response

from app import photos
from app.config import get_settings
from app.db import DB, many, now, one
from app.models import ListingUpdate, LoginIn, NoteIn, VisitStatus, VisitUpdate

TOKEN_TTL = 7 * 24 * 3600

router = APIRouter(prefix="/api/admin")


# --- Auth -----------------------------------------------------------------


def _key() -> bytes:
    return hashlib.sha256(b"nilayam-admin:" + get_settings().admin_password.encode()).digest()


def make_token() -> str:
    exp = str(int(time.time()) + TOKEN_TTL)
    return f"{exp}.{hmac.new(_key(), exp.encode(), hashlib.sha256).hexdigest()}"


def require_admin(authorization: str | None = Header(None)) -> None:
    if not get_settings().admin_password:
        raise HTTPException(503, "Admin is disabled: set ADMIN_PASSWORD")
    token = (authorization or "").removeprefix("Bearer ").strip()
    exp, _, sig = token.partition(".")
    expected = hmac.new(_key(), exp.encode(), hashlib.sha256).hexdigest()
    if not (exp.isdigit() and hmac.compare_digest(sig, expected) and int(exp) > time.time()):
        raise HTTPException(401, "Not authenticated")


@router.post("/login")
def login(body: LoginIn) -> dict:
    password = get_settings().admin_password
    if not password:
        raise HTTPException(503, "Admin is disabled: set ADMIN_PASSWORD")
    if not hmac.compare_digest(body.password.encode(), password.encode()):
        time.sleep(0.5)  # slow down guessing
        raise HTTPException(401, "Wrong password")
    return {"token": make_token()}


guarded = APIRouter(dependencies=[Depends(require_admin)])


# --- Helpers ----------------------------------------------------------------


def set_status(db: sqlite3.Connection, submission_id: str, status: str, note: str | None = None) -> None:
    db.execute(
        "update submissions set status = ?, status_note = coalesce(?, status_note), status_updated_at = ? where id = ?",
        (status, note, now(), submission_id),
    )


def get_listing_row(db: sqlite3.Connection, listing_id: str) -> dict:
    listing = one(db, "select * from listings where id = ?", listing_id)
    if listing is None:
        raise HTTPException(404, "Listing not found")
    return listing


# --- Submissions ------------------------------------------------------------

SubmissionStatus = Literal["received", "under_review", "listed", "sold", "withdrawn", "rejected"]


@guarded.get("/submissions")
def list_submissions(db: DB, status: SubmissionStatus | None = None) -> list[dict]:
    return many(
        db,
        """select s.id, s.ref_code, s.seller_name, s.seller_phone, s.property_type, s.land_area_cents,
                  s.location, s.expected_price, s.status, s.created_at, l.id as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where ? is null or s.status = ? order by s.created_at desc limit 500""",
        status, status,
    )  # fmt: skip


@guarded.get("/submissions/{submission_id}")
def get_submission(submission_id: str, db: DB) -> dict:
    sub = one(
        db,
        "select s.*, l.id as listing_id from submissions s left join listings l on l.submission_id = s.id"
        " where s.id = ?",
        submission_id,
    )
    if sub is None:
        raise HTTPException(404, "Submission not found")
    sub.pop("device_hash")
    sub["photos"] = [
        {"id": p["id"], "url": f"/api/admin/photos/{p['id']}"}
        for p in many(db, "select id from photos where submission_id = ? order by position", submission_id)
    ]
    return sub


@guarded.get("/photos/{photo_id}")
def get_private_photo(photo_id: str, db: DB) -> Response:
    row = one(db, "select path from photos where id = ?", photo_id)
    try:
        data = photos.read(row["path"]) if row else None
    except OSError:
        data = None
    if data is None:
        raise HTTPException(404, "Photo not found")
    return Response(data, media_type="image/webp", headers={"Cache-Control": "private, max-age=300"})


@guarded.post("/submissions/{submission_id}/reject")
def reject(submission_id: str, body: NoteIn, db: DB) -> dict:
    sub = one(db, "select status from submissions where id = ?", submission_id)
    if sub is None:
        raise HTTPException(404, "Submission not found")
    if sub["status"] not in ("received", "under_review") or one(
        db, "select 1 from listings where submission_id = ?", submission_id
    ):
        raise HTTPException(409, "Only unlisted submissions can be rejected")
    set_status(db, submission_id, "rejected", body.note)
    return {"id": submission_id, "status": "rejected"}


@guarded.post("/submissions/{submission_id}/draft", status_code=201)
def create_draft(submission_id: str, db: DB) -> dict:
    """Create the public draft. Seller name and phone are never copied."""
    sub = one(db, "select * from submissions where id = ?", submission_id)
    if sub is None:
        raise HTTPException(404, "Submission not found")
    if sub["status"] not in ("received", "under_review"):
        raise HTTPException(409, f"Submission is {sub['status']}")
    if one(db, "select 1 from listings where submission_id = ?", submission_id):
        raise HTTPException(409, "Draft already exists")

    photo_ids = [
        p["id"] for p in many(db, "select id from photos where submission_id = ? order by position", sub["id"])
    ]
    number = db.execute("select coalesce(max(number), 1000) + 1 from listings").fetchone()[0]
    kind = "House" if sub["property_type"] == "house" else "Land"
    title = f"{kind} · {sub['land_area_cents']:g} cents · {sub['location']}"[:120]
    listing_id = str(uuid.uuid4())
    db.execute(
        """insert into listings (id, number, submission_id, title, property_type, land_area_cents, location,
               description, price, negotiable, documents_available, documents_note, photo_ids)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (listing_id, number, submission_id, title, sub["property_type"], sub["land_area_cents"], sub["location"],
         sub["description"], sub["expected_price"], sub["negotiable"], sub["documents_available"],
         sub["documents_note"], json.dumps(photo_ids)),
    )  # fmt: skip
    set_status(db, submission_id, "under_review")
    return get_listing_row(db, listing_id)


# --- Listings -----------------------------------------------------------------

ListingState = Literal["draft", "published", "sold", "withdrawn"]


@guarded.get("/listings")
def list_listings(db: DB, state: ListingState | None = None) -> list[dict]:
    return many(
        db,
        """select id, number, submission_id, state, title, property_type, location, price, current_version,
                  published_at, sold_at, updated_at
           from listings where ? is null or state = ? order by updated_at desc limit 500""",
        state, state,
    )  # fmt: skip


@guarded.get("/listings/{listing_id}")
def get_listing(listing_id: str, db: DB) -> dict:
    listing = get_listing_row(db, listing_id)
    listing["versions"] = many(
        db,
        "select version, published_at, snapshot from published_versions where listing_id = ? order by version desc",
        listing_id,
    )
    return listing


@guarded.patch("/listings/{listing_id}")
def update_listing(listing_id: str, body: ListingUpdate, db: DB) -> dict:
    listing = get_listing_row(db, listing_id)
    if listing["state"] == "sold":
        raise HTTPException(409, "Sold listings cannot be edited")
    changes = body.model_dump(exclude_unset=True)
    if None in changes.values():
        raise HTTPException(422, "Fields cannot be null")
    if "photo_ids" in changes:
        valid = {p["id"] for p in many(db, "select id from photos where submission_id = ?", listing["submission_id"])}
        ids = changes["photo_ids"]
        if not set(ids) <= valid or len(set(ids)) != len(ids):
            raise HTTPException(422, "photo_ids must be distinct photos from this submission")
        changes["photo_ids"] = json.dumps(ids)
    if changes:
        # Column names come from the validated model, never from user input.
        sets = ", ".join(f"{k} = ?" for k in changes)
        db.execute(f"update listings set {sets}, updated_at = ? where id = ?", (*changes.values(), now(), listing_id))  # noqa: S608
    return get_listing_row(db, listing_id)


@guarded.post("/listings/{listing_id}/price-confirmation")
def confirm_price(listing_id: str, db: DB) -> dict:
    """Record that the seller confirmed the listing's current price."""
    listing = get_listing_row(db, listing_id)
    db.execute("update listings set confirmed_price = price, updated_at = ? where id = ?", (now(), listing_id))
    return {"id": listing_id, "confirmed_price": listing["price"]}


@guarded.post("/listings/{listing_id}/publish")
def publish(listing_id: str, db: DB) -> dict:
    listing = get_listing_row(db, listing_id)
    if listing["state"] == "sold":
        raise HTTPException(409, "Listing is already sold")
    if not listing["photo_ids"]:
        raise HTTPException(422, "Select at least one photo before publishing")

    # Material price change (vs last published price, or seller's expected price) needs seller confirmation.
    if listing["current_version"]:
        last = one(
            db, "select snapshot from published_versions where listing_id = ? and version = ?",
            listing_id, listing["current_version"],
        )  # fmt: skip
        reference = last["snapshot"]["price"]
    else:
        reference = one(db, "select expected_price from submissions where id = ?", listing["submission_id"])[
            "expected_price"
        ]
    change = abs(listing["price"] - reference) * 100 / reference
    if change > get_settings().material_price_change_pct and listing["confirmed_price"] != listing["price"]:
        raise HTTPException(409, f"Price differs {change:.1f}% from ₹{reference:,}; record seller confirmation first")

    paths = {
        p["id"]: p["path"]
        for p in many(db, "select id, path from photos where submission_id = ?", listing["submission_id"])
    }
    snapshot = {
        "number": listing["number"],
        "title": listing["title"],
        "property_type": listing["property_type"],
        "land_area_cents": listing["land_area_cents"],
        "location": listing["location"],
        "description": listing["description"],
        "price": listing["price"],
        "negotiable": listing["negotiable"],
        "documents_available": listing["documents_available"],
        "documents_note": listing["documents_note"],
        "photos": [photos.publish_copy(paths[pid], listing_id, pid) for pid in listing["photo_ids"]],
    }
    version = listing["current_version"] + 1
    db.execute(
        "insert into published_versions (listing_id, version, snapshot) values (?, ?, ?)",
        (listing_id, version, json.dumps(snapshot)),
    )
    db.execute(
        "update listings set state = 'published', current_version = ?, published_at = ?, updated_at = ? where id = ?",
        (version, now(), now(), listing_id),
    )
    set_status(db, listing["submission_id"], "listed")
    return {"id": listing_id, "state": "published", "version": version, "snapshot": snapshot}


def _transition(db: sqlite3.Connection, listing_id: str, to: str, submission_status: str) -> dict:
    listing = get_listing_row(db, listing_id)
    if listing["state"] != "published":
        raise HTTPException(409, f"Listing is {listing['state']}, not published")
    db.execute(
        "update listings set state = ?, sold_at = case when ? = 'sold' then ? else sold_at end, updated_at = ?"
        " where id = ?",
        (to, to, now(), now(), listing_id),
    )
    set_status(db, listing["submission_id"], submission_status)
    return {"id": listing_id, "state": to}


@guarded.post("/listings/{listing_id}/sold")
def mark_sold(listing_id: str, db: DB) -> dict:
    return _transition(db, listing_id, "sold", "sold")


@guarded.post("/listings/{listing_id}/withdraw")
def withdraw(listing_id: str, db: DB) -> dict:
    return _transition(db, listing_id, "withdrawn", "withdrawn")


# --- Visits -------------------------------------------------------------------


@guarded.get("/visits")
def list_visits(db: DB, status: VisitStatus | None = None) -> list[dict]:
    return many(
        db,
        """select v.*, l.number as listing_number, l.title as listing_title
           from visit_requests v join listings l on l.id = v.listing_id
           where ? is null or v.status = ? order by v.created_at desc limit 500""",
        status, status,
    )  # fmt: skip


@guarded.patch("/visits/{visit_id}")
def update_visit(visit_id: str, body: VisitUpdate, db: DB) -> dict:
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        raise HTTPException(422, "Nothing to update")
    sets = ", ".join(f"{k} = ?" for k in changes)
    cur = db.execute(
        f"update visit_requests set {sets}, updated_at = ? where id = ?", (*changes.values(), now(), visit_id)
    )  # noqa: S608
    if cur.rowcount == 0:
        raise HTTPException(404, "Visit request not found")
    return one(db, "select * from visit_requests where id = ?", visit_id)


router.include_router(guarded)
