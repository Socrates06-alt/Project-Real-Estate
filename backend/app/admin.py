"""Admin API. Prototype auth: one password (ADMIN_PASSWORD) -> signed, expiring token."""

import hashlib
import hmac
import json
import re
import sqlite3
import time
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile

from app import geo, photos
from app.config import get_settings
from app.db import DB, many, now, one
from app.models import LoginIn, NoteIn, PublishIn, VisitUpdate

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

# Simple groups the admin sees, mapped from the stored submission status.
GROUPS = {
    "new": ("received", "under_review"),
    "live": ("listed",),
    "sold": ("sold",),
    "not_listed": ("withdrawn", "rejected"),
}
Group = Literal["new", "live", "sold", "not_listed"]


def group_of(status: str) -> str:
    return next(g for g, statuses in GROUPS.items() if status in statuses)


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


_ROW = """
    select s.id, s.number, s.seller_name, s.seller_phone, s.property_type, s.location, s.status, s.created_at,
           s.wants_doc_help,
           coalesce(l.price, s.expected_price) as price, l.id as listing_id,
           coalesce(l.title, '') as title,
           (select id from photos p where p.submission_id = s.id order by position limit 1) as cover_photo_id,
           (select count(*) from visit_requests v
             where v.listing_id = l.id and v.status in ('new', 'contacted', 'scheduled')) as open_visits
    from submissions s left join listings l on l.submission_id = s.id
"""


def _row(r: dict) -> dict:
    r["group"] = group_of(r.pop("status"))
    r["cover_url"] = f"/api/admin/photos/{r['cover_photo_id']}" if r["cover_photo_id"] else None
    return r


# --- Inbox & properties -----------------------------------------------------


@guarded.get("/inbox")
def inbox(db: DB) -> dict:
    """Everything that needs a founder's attention, plus simple counts."""
    new = many(db, f"{_ROW} where s.status in ('received', 'under_review') order by s.created_at desc limit 100")
    visits = many(
        db,
        """select v.id, v.name, v.phone, v.preferred_time, v.budget, v.status, v.created_at,
                  l.number as listing_number, l.title as listing_title, l.submission_id as property_id
           from visit_requests v join listings l on l.id = v.listing_id
           where v.status in ('new', 'contacted', 'scheduled') order by v.created_at desc limit 100""",
    )
    counts = {g: 0 for g in GROUPS}
    for r in db.execute("select status, count(*) from submissions group by status"):
        counts[group_of(r[0])] += r[1]
    return {"new": [_row(r) for r in new], "visits": visits, "counts": counts}


@guarded.get("/properties")
def list_properties(db: DB, group: Group = "live", q: str = Query("", max_length=200)) -> list[dict]:
    """A group's properties, or, with q, a search across all of them."""
    q = q.strip().lstrip("#")
    if not q:
        statuses = GROUPS[group]
        rows = many(
            db,
            f"{_ROW} where s.status in ({','.join('?' * len(statuses))}) order by s.status_updated_at desc limit 500",
            *statuses,
        )
        return [_row(r) for r in rows]

    # A property link pasted from a buyer's WhatsApp message: .../p/<listing id>
    if m := re.search(r"/p/([0-9a-fA-F-]{36})", q):
        rows = many(db, f"{_ROW} where l.id = ?", m.group(1))
        return [_row(r) for r in rows]

    digits = re.sub(r"\D", "", q)
    conditions, args = ["lower(s.seller_name) like ?"], [f"%{q.lower()}%"]
    if digits and len(digits) <= 6:  # a property number like 1001
        conditions.append("s.number = ?")
        args.append(int(digits))
    if len(digits) >= 4:  # (part of) a phone number, any format: +91, spaces, leading 0
        phone = digits[2:] if len(digits) == 12 and digits.startswith("91") else digits.lstrip("0")
        conditions.append("s.seller_phone like ?")
        args.append(f"%{phone}%")
    rows = many(db, f"{_ROW} where {' or '.join(conditions)} order by s.created_at desc limit 50", *args)
    return [_row(r) for r in rows]


@guarded.get("/properties/{submission_id}")
def get_property(submission_id: str, db: DB) -> dict:
    sub = get_submission(db, submission_id)
    sub.pop("device_hash")
    listing = one(db, "select * from listings where submission_id = ?", submission_id)
    photo_rows = many(db, "select id from photos where submission_id = ? order by position", submission_id)
    kind = {"house": "House", "land": "Land", "commercial": "Commercial property"}[sub["property_type"]]
    # The editable form: current listing, or a ready-made one from the seller's submission (no seller identity).
    form = (
        {**{k: listing[k] for k in PUBLIC_FIELDS}, "lat": listing["lat"], "lng": listing["lng"]}
        if listing
        else {
            "title": f"{kind} for sale",  # area and place are shown separately
            "property_type": sub["property_type"],
            "land_area_cents": sub["land_area_cents"],
            "location": sub["location"],
            "description": sub["description"],
            "price": sub["expected_price"],
            "negotiable": sub["negotiable"],
            "documents_available": sub["documents_available"],
            "documents_note": sub["documents_note"],
            "photo_ids": [p["id"] for p in photo_rows],
            "lat": sub["area_lat"],
            "lng": sub["area_lng"],
        }
    )
    visits = (
        many(db, "select * from visit_requests where listing_id = ? order by created_at desc", listing["id"])
        if listing
        else []
    )
    return {
        "id": submission_id,
        "group": group_of(sub["status"]),
        "seller": sub,
        "photos": [{"id": p["id"], "url": f"/api/admin/photos/{p['id']}"} for p in photo_rows],
        "listing_id": listing["id"] if listing else None,
        "number": sub["number"],
        "reference_price": _reference_price(db, sub, listing),
        "form": form,
        "visits": visits,
    }


@guarded.post("/properties/{submission_id}/photos", status_code=201)
def add_photos(submission_id: str, db: DB, photo_files: Annotated[list[UploadFile], File(alias="photos")]) -> dict:
    """Admin adds photos when the seller didn't (cleaned the same way; up to the photo limit)."""
    get_submission(db, submission_id)
    s = get_settings()
    have = db.execute("select count(*) from photos where submission_id = ?", (submission_id,)).fetchone()[0]
    if have + len(photo_files) > s.max_photos:
        raise HTTPException(422, f"Up to {s.max_photos} photos per property")
    added = []
    for f in photo_files:
        data = f.file.read(s.max_photo_bytes + 1)
        if len(data) > s.max_photo_bytes:
            raise HTTPException(413, "Each photo must be under 8 MB")
        try:
            clean = photos.sanitize(data)
        except photos.InvalidImage as exc:
            raise HTTPException(422, str(exc)) from exc
        photo_id = str(uuid.uuid4())
        path = photos.save_original(submission_id, photo_id, clean)
        db.execute(
            "insert into photos (id, submission_id, path, position) values (?, ?, ?, ?)",
            (photo_id, submission_id, path, have + len(added)),
        )
        added.append({"id": photo_id, "url": f"/api/admin/photos/{photo_id}"})
    return {"photos": added}


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


# --- Publish (one step: create/update listing + publish a snapshot) -----------

PUBLIC_FIELDS = (
    "title", "property_type", "land_area_cents", "location", "description",
    "price", "negotiable", "documents_available", "documents_note", "photo_ids",
)  # fmt: skip


def _reference_price(db: sqlite3.Connection, sub: dict, listing: dict | None) -> int:
    """Last published price, or the seller's expected price before the first publish."""
    if listing and listing["current_version"]:
        last = one(
            db, "select snapshot from published_versions where listing_id = ? and version = ?",
            listing["id"], listing["current_version"],
        )  # fmt: skip
        return last["snapshot"]["price"]
    return sub["expected_price"]


@guarded.post("/properties/{submission_id}/publish")
def publish(submission_id: str, body: PublishIn, db: DB) -> dict:
    sub = get_submission(db, submission_id)
    if sub["status"] == "sold":
        raise HTTPException(409, "This property is already sold")
    valid_photos = {
        p["id"]: p["path"] for p in many(db, "select id, path from photos where submission_id = ?", submission_id)
    }
    if not set(body.photo_ids) <= valid_photos.keys() or len(set(body.photo_ids)) != len(body.photo_ids):
        raise HTTPException(422, "Invalid photos")

    listing = one(db, "select * from listings where submission_id = ?", submission_id)
    reference = _reference_price(db, sub, listing)
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
    return {"id": submission_id, "listing_id": listing_id, "number": number, "group": "live"}


# --- Other actions ----------------------------------------------------------


def _end_listing(db: sqlite3.Connection, submission_id: str, state: str, status: str) -> dict:
    sub = get_submission(db, submission_id)
    if sub["status"] != "listed":
        raise HTTPException(409, "Only live properties can be changed this way")
    db.execute(
        "update listings set state = ?, sold_at = case when ? = 'sold' then ? else sold_at end, updated_at = ?"
        " where submission_id = ?",
        (state, state, now(), now(), submission_id),
    )
    set_status(db, submission_id, status)
    return {"id": submission_id, "group": group_of(status)}


@guarded.post("/properties/{submission_id}/sold")
def mark_sold(submission_id: str, db: DB) -> dict:
    return _end_listing(db, submission_id, "sold", "sold")


@guarded.post("/properties/{submission_id}/take-down")
def take_down(submission_id: str, db: DB) -> dict:
    return _end_listing(db, submission_id, "withdrawn", "withdrawn")


@guarded.post("/properties/{submission_id}/not-listed")
def not_listed(submission_id: str, body: NoteIn, db: DB) -> dict:
    """A new submission we won't list (optional reason)."""
    sub = get_submission(db, submission_id)
    if sub["status"] not in GROUPS["new"]:
        raise HTTPException(409, "Only new properties can be marked not listed")
    set_status(db, submission_id, "rejected", body.note or None)
    return {"id": submission_id, "group": "not_listed"}


@guarded.patch("/visits/{visit_id}")
def update_visit(visit_id: str, body: VisitUpdate, db: DB) -> dict:
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        raise HTTPException(422, "Nothing to update")
    sets = ", ".join(f"{k} = ?" for k in changes)  # column names from the model only
    cur = db.execute(
        f"update visit_requests set {sets}, updated_at = ? where id = ?", (*changes.values(), now(), visit_id)
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Visit request not found")
    return one(db, "select * from visit_requests where id = ?", visit_id)


router.include_router(guarded)
