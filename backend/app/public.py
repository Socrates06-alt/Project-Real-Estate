"""Public API: browse, property details, visit requests, seller submission, My listings."""

import hashlib
import re
import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile

from app import photos
from app.config import get_settings
from app.db import DB, many, one
from app.models import SubmissionForm, VisitRequestIn
from app.search import parse_query

router = APIRouter(prefix="/api")

_REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_STATES = {"live": ("published",), "sold": ("sold",), "all": ("published", "sold")}
_SNAPSHOT_FIELDS = (
    "number", "title", "property_type", "land_area_cents", "location", "description",
    "price", "negotiable", "documents_available", "documents_note", "photos",
)  # fmt: skip


def contact() -> dict:
    s = get_settings()
    return {"phone": s.contact_phone, "whatsapp": s.contact_whatsapp}


def device_hash(x_device_token: str = Header(...)) -> str:
    """Anonymous per-device identity for 'My listings'. Only the hash is stored."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", x_device_token):
        raise HTTPException(400, "Invalid device token")
    return hashlib.sha256(x_device_token.encode()).hexdigest()


def public_listing(row: dict) -> dict:
    """Only the published snapshot (already sanitized) is ever shown publicly."""
    snap = row["snapshot"]
    return {
        "id": row["id"],
        "status": "sold" if row["state"] == "sold" else "live",
        "version": row["version"],
        **{k: snap.get(k) for k in _SNAPSHOT_FIELDS},
        "published_at": row["published_at"],
        "sold_at": row["sold_at"],
    }


_LIVE_SELECT = """
    select l.id, l.state, l.sold_at, v.version, v.snapshot, v.published_at
    from listings l
    join published_versions v on v.listing_id = l.id and v.version = l.current_version
"""


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/config")
def public_config() -> dict:
    s = get_settings()
    return {
        "contact": contact(),
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


@router.get("/listings")
def list_listings(
    db: DB,
    q: str = Query("", max_length=200),
    type: Literal["house", "land"] | None = None,
    status: Literal["live", "sold", "all"] = "live",
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> dict:
    parsed = parse_query(q)
    states = _STATES[status]
    where = [f"l.state in ({','.join('?' * len(states))})"]
    args: list = list(states)

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
    for word in parsed.text.split():
        where.append(
            "lower(json_extract(v.snapshot, '$.title') || ' ' || json_extract(v.snapshot, '$.location')"
            " || ' ' || json_extract(v.snapshot, '$.description')) like ?"
        )
        args.append(f"%{word}%")

    rows = many(
        db,
        f"{_LIVE_SELECT} where {' and '.join(where)}"
        " order by l.state = 'published' desc, v.published_at desc limit ? offset ?",
        *args, limit + 1, offset,
    )  # fmt: skip
    return {
        "items": [public_listing(r) for r in rows[:limit]],
        "has_more": len(rows) > limit,
        "parsed": parsed.__dict__,
        "contact": contact(),
    }


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str, db: DB) -> dict:
    row = one(db, f"{_LIVE_SELECT} where l.id = ? and l.state in ('published', 'sold')", listing_id)
    if row is None:
        raise HTTPException(404, "Listing not found")
    s = get_settings()
    return {
        **public_listing(row),
        "contact": contact(),
        "brokerage": {"buyer_pct": s.buyer_brokerage_pct, "gst_extra": True},
    }


@router.post("/listings/{listing_id}/visit-requests", status_code=201)
def request_visit(listing_id: str, body: VisitRequestIn, db: DB) -> dict:
    if not one(db, "select 1 from listings where id = ? and state = 'published'", listing_id):
        raise HTTPException(404, "Listing not available for visits")
    existing = one(
        db,
        "select id, status from visit_requests"
        " where listing_id = ? and phone = ? and status in ('new', 'contacted', 'scheduled')",
        listing_id, body.phone,
    )  # fmt: skip
    if existing:
        return existing
    visit_id = str(uuid.uuid4())
    db.execute(
        "insert into visit_requests (id, listing_id, name, phone, preferred_time, budget) values (?, ?, ?, ?, ?, ?)",
        (visit_id, listing_id, body.name, body.phone, body.preferred_time, body.budget),
    )
    return {"id": visit_id, "status": "new"}


@router.post("/submissions", status_code=201)
def create_submission(
    form: Annotated[SubmissionForm, Form()],
    photo_files: Annotated[list[UploadFile], File(alias="photos")],
    device: Annotated[str, Depends(device_hash)],
    db: DB,
) -> dict:
    s = get_settings()
    if not form.consent or form.consent_version != s.consent_version:
        raise HTTPException(422, "Please accept the current brokerage terms")
    if not 1 <= len(photo_files) <= s.max_photos:
        raise HTTPException(422, f"Upload between 1 and {s.max_photos} photos")

    images = []
    for f in photo_files:
        data = f.file.read(s.max_photo_bytes + 1)
        if len(data) > s.max_photo_bytes:
            raise HTTPException(413, "Each photo must be under 8 MB")
        try:
            images.append(photos.sanitize(data))
        except photos.InvalidImage as exc:
            raise HTTPException(422, str(exc)) from exc

    sub_id = str(uuid.uuid4())
    ref_code = "NLY-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))
    db.execute(
        """insert into submissions (id, ref_code, device_hash, seller_name, seller_phone, property_type,
               land_area_cents, location, description, expected_price, negotiable, documents_available,
               documents_note, consent_version)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sub_id, ref_code, device, form.seller_name, form.seller_phone, form.property_type,
         form.land_area_cents, form.location, form.description, form.expected_price, form.negotiable,
         form.documents_available, form.documents_note, form.consent_version),
    )  # fmt: skip
    saved: list[str] = []
    try:
        for position, data in enumerate(images):
            photo_id = str(uuid.uuid4())
            saved.append(photos.save_original(sub_id, photo_id, data))
            db.execute(
                "insert into photos (id, submission_id, path, position) values (?, ?, ?, ?)",
                (photo_id, sub_id, saved[-1], position),
            )
    except OSError as exc:
        photos.delete_files(saved)
        raise HTTPException(503, "Could not save photos, please try again") from exc

    return {"id": sub_id, "ref_code": ref_code, "status": "received"}


@router.get("/my/submissions")
def my_submissions(device: Annotated[str, Depends(device_hash)], db: DB) -> list[dict]:
    return many(
        db,
        """select s.id, s.ref_code, s.property_type, s.location, s.expected_price, s.status, s.created_at,
                  case when l.state in ('published', 'sold') then l.id end as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where s.device_hash = ? order by s.created_at desc limit 50""",
        device,
    )
