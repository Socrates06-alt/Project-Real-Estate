"""Admin: inbox, properties, the property editor and its actions. Every endpoint needs an admin token."""

import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile

from app.admin import service
from app.admin.schemas import NoteIn, PublishIn
from app.core.config import get_settings
from app.core.db import DB, many, one
from app.core.security import require_admin
from app.submissions import photos
from app.submissions import service as submissions
from app.submissions.schemas import SubmissionForm

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

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
    r["group"] = service.group_of(r.pop("status"))
    r["cover_url"] = f"/api/admin/photos/{r['cover_photo_id']}" if r["cover_photo_id"] else None
    return r


# --- Inbox & properties -----------------------------------------------------


@router.get("/inbox")
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
    counts = {g: 0 for g in service.GROUPS}
    for r in db.execute("select status, count(*) from submissions group by status"):
        counts[service.group_of(r[0])] += r[1]
    return {"new": [_row(r) for r in new], "visits": visits, "counts": counts}


@router.get("/properties")
def list_properties(db: DB, group: service.Group = "live", q: str = Query("", max_length=200)) -> list[dict]:
    """A group's properties, or, with q, a search across all of them."""
    q = q.strip().lstrip("#")
    if not q:
        statuses = service.GROUPS[group]
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


@router.post("/properties", status_code=201)
def add_property(
    form: Annotated[SubmissionForm, Form()],
    db: DB,
    photo_files: Annotated[list[UploadFile] | None, File(alias="photos")] = None,
) -> dict:
    """A founder enters a seller's property (e.g. after a visit or phone call). Seller must have agreed to the terms."""
    submissions.check_consent(form)
    images = submissions.read_photos(photo_files)
    return submissions.create(db, form, submissions.ADMIN_ENTERED, images)


@router.get("/properties/{submission_id}")
def get_property(submission_id: str, db: DB) -> dict:
    sub = service.get_submission(db, submission_id)
    sub.pop("device_hash")
    listing = one(db, "select * from listings where submission_id = ?", submission_id)
    photo_rows = many(db, "select id from photos where submission_id = ? order by position", submission_id)
    kind = {"house": "House", "land": "Land", "commercial": "Commercial property"}[sub["property_type"]]
    # The editable form: current listing, or a ready-made one from the seller's submission (no seller identity).
    form = (
        {**{k: listing[k] for k in service.PUBLIC_FIELDS}, "lat": listing["lat"], "lng": listing["lng"]}
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
        "group": service.group_of(sub["status"]),
        "seller": sub,
        "photos": [{"id": p["id"], "url": f"/api/admin/photos/{p['id']}"} for p in photo_rows],
        "listing_id": listing["id"] if listing else None,
        "number": sub["number"],
        "reference_price": service.reference_price(db, sub, listing),
        "form": form,
        "visits": visits,
    }


@router.post("/properties/{submission_id}/photos", status_code=201)
def add_photos(submission_id: str, db: DB, photo_files: Annotated[list[UploadFile], File(alias="photos")]) -> dict:
    """Admin adds photos when the seller didn't (cleaned the same way; up to the photo limit)."""
    service.get_submission(db, submission_id)
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


@router.get("/photos/{photo_id}")
def get_private_photo(photo_id: str, db: DB) -> Response:
    row = one(db, "select path from photos where id = ?", photo_id)
    try:
        data = photos.read(row["path"]) if row else None
    except OSError:
        data = None
    if data is None:
        raise HTTPException(404, "Photo not found")
    return Response(data, media_type="image/webp", headers={"Cache-Control": "private, max-age=300"})


# --- Publish and other actions ------------------------------------------------


@router.post("/properties/{submission_id}/publish")
def publish(submission_id: str, body: PublishIn, db: DB) -> dict:
    return service.publish(db, submission_id, body)


@router.post("/properties/{submission_id}/sold")
def mark_sold(submission_id: str, db: DB) -> dict:
    return service.end_listing(db, submission_id, "sold", "sold")


@router.post("/properties/{submission_id}/take-down")
def take_down(submission_id: str, db: DB) -> dict:
    return service.end_listing(db, submission_id, "withdrawn", "withdrawn")


@router.post("/properties/{submission_id}/not-listed")
def not_listed(submission_id: str, body: NoteIn, db: DB) -> dict:
    """A new submission we won't list (optional reason)."""
    sub = service.get_submission(db, submission_id)
    if sub["status"] not in service.GROUPS["new"]:
        raise HTTPException(409, "Only new properties can be marked not listed")
    service.set_status(db, submission_id, "rejected", body.note or None)
    return {"id": submission_id, "group": "not_listed"}
