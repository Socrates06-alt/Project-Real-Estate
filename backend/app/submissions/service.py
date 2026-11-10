"""Saving a property submission (seller's original details + cleaned photos).

Used by the public Sell form and by admins adding a property for a seller.
"""

import sqlite3
import uuid

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.semantic import store as semantic
from app.submissions import photos
from app.submissions.schemas import SubmissionForm

# Stored instead of a device hash when a founder enters the property (never matches a real device).
ADMIN_ENTERED = "admin"


def check_consent(form: SubmissionForm) -> None:
    if not form.consent or form.consent_version != get_settings().consent_version:
        raise HTTPException(422, "Please accept the current brokerage terms")


def read_photos(photo_files: list[UploadFile] | None) -> list[bytes]:
    """Validate and clean uploaded photos (type, size, metadata). Photos are optional."""
    s = get_settings()
    photo_files = photo_files or []
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
    return images


def create(db: sqlite3.Connection, form: SubmissionForm, device: str, images: list[bytes]) -> dict:
    """Save the submission and its photos; it gets the next property number."""
    s = get_settings()
    sub_id = str(uuid.uuid4())
    number = db.execute("select coalesce(max(number) + 1, ?) from submissions", (s.first_property_number,)).fetchone()[
        0
    ]
    db.execute(
        """insert into submissions (id, number, device_hash, seller_name, seller_phone, property_type,
               land_area_cents, location, area_lat, area_lng, address, description, expected_price, negotiable,
               documents_available, documents_note, wants_doc_help, wants_dev_help, consent_version)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sub_id, number, device, form.seller_name, form.seller_phone, form.property_type,
         form.land_area_cents, form.location, form.area_lat, form.area_lng, form.address, form.description,
         form.expected_price, form.negotiable, form.documents_available, form.documents_note,
         form.wants_doc_help, form.wants_dev_help, form.consent_version),
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
    semantic.refresh_property(db, sub_id)
    return {"id": sub_id, "number": number, "status": "received"}
