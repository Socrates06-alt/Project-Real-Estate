"""Sellers: submit a property (photos optional), and see "My listings" on the same device."""

import hashlib
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.db import DB, many
from app.submissions import photos
from app.submissions.schemas import SubmissionForm

router = APIRouter(prefix="/api")


def device_hash(x_device_token: str = Header(...)) -> str:
    """Anonymous per-device identity for 'My listings'. Only the hash is stored."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", x_device_token):
        raise HTTPException(400, "Invalid device token")
    return hashlib.sha256(x_device_token.encode()).hexdigest()


@router.post("/submissions", status_code=201)
def create_submission(
    form: Annotated[SubmissionForm, Form()],
    device: Annotated[str, Depends(device_hash)],
    db: DB,
    photo_files: Annotated[list[UploadFile] | None, File(alias="photos")] = None,
) -> dict:
    s = get_settings()
    if not form.consent or form.consent_version != s.consent_version:
        raise HTTPException(422, "Please accept the current brokerage terms")
    photo_files = photo_files or []  # photos are optional
    if len(photo_files) > s.max_photos:
        raise HTTPException(422, f"Upload up to {s.max_photos} photos")

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
    number = db.execute("select coalesce(max(number) + 1, ?) from submissions", (s.first_property_number,)).fetchone()[
        0
    ]
    db.execute(
        """insert into submissions (id, number, device_hash, seller_name, seller_phone, property_type,
               land_area_cents, location, area_lat, area_lng, address, description, expected_price, negotiable,
               documents_available, documents_note, wants_doc_help, consent_version)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sub_id, number, device, form.seller_name, form.seller_phone, form.property_type,
         form.land_area_cents, form.location, form.area_lat, form.area_lng, form.address, form.description,
         form.expected_price, form.negotiable, form.documents_available, form.documents_note,
         form.wants_doc_help, form.consent_version),
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

    return {"id": sub_id, "number": number, "status": "received"}


@router.get("/my/submissions")
def my_submissions(device: Annotated[str, Depends(device_hash)], db: DB) -> list[dict]:
    return many(
        db,
        """select s.id, s.number, s.property_type, s.location, s.expected_price, s.status, s.created_at,
                  case when l.state in ('published', 'sold') then l.id end as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where s.device_hash = ? order by s.created_at desc, s.number desc limit 50""",
        device,
    )
