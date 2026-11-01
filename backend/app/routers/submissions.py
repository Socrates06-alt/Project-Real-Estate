import logging
import secrets
import uuid
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.config import get_settings
from app.db import get_conn
from app.images import InvalidImage, sanitize_image
from app.ratelimit import rate_limit
from app.schemas import MySubmission, SubmissionCreated, SubmissionForm
from app.security import client_ip, device_token_hash, ip_hash
from app.storage import Storage, StorageError, get_storage
from app.turnstile import verify_turnstile

router = APIRouter(tags=["seller"])
log = logging.getLogger(__name__)

_REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _ref_code() -> str:
    return "NLY-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))


def _read_photos(photos: list[UploadFile]) -> list[bytes]:
    s = get_settings()
    if not 1 <= len(photos) <= s.max_photos:
        raise HTTPException(422, f"Upload between 1 and {s.max_photos} photos")
    out = []
    for photo in photos:
        data = photo.file.read(s.max_photo_bytes + 1)
        if len(data) > s.max_photo_bytes:
            raise HTTPException(413, f"Each photo must be under {s.max_photo_bytes // (1024 * 1024)} MB")
        try:
            out.append(sanitize_image(data))
        except InvalidImage as exc:
            raise HTTPException(422, str(exc)) from exc
    return out


@router.post("/submissions", status_code=201)
def create_submission(
    form: Annotated[SubmissionForm, Form()],
    photos: Annotated[list[UploadFile], File()],
    request: Request,
    device_hash: str = Depends(device_token_hash),
    conn: psycopg.Connection = Depends(get_conn),
    storage: Storage = Depends(get_storage),
    _: None = Depends(rate_limit("submit", 5, 3600)),
) -> SubmissionCreated:
    s = get_settings()
    if not form.consent or form.consent_version != s.consent_version:
        raise HTTPException(422, "Please accept the current brokerage terms")
    verify_turnstile(form.turnstile_token, client_ip(request))
    images = _read_photos(photos)

    submission_id = uuid.uuid4()
    ref_code = _ref_code()
    conn.execute(
        """insert into submissions (id, ref_code, device_token_hash, seller_name, seller_phone,
               property_type, land_area_cents, location, description, expected_price, negotiable,
               documents_available, documents_note, consent_version, consent_at, ip_hash)
           values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)""",
        (
            submission_id,
            ref_code,
            device_hash,
            form.seller_name,
            form.seller_phone,
            form.property_type.value,
            form.land_area_cents,
            form.location,
            form.description,
            form.expected_price,
            form.negotiable,
            form.documents_available,
            form.documents_note,
            form.consent_version,
            ip_hash(request),
        ),
    )

    uploaded: list[str] = []
    try:
        for position, data in enumerate(images):
            photo_id = uuid.uuid4()
            path = f"{submission_id}/{photo_id}.webp"
            storage.put(s.private_bucket, path, data, "image/webp")
            uploaded.append(path)
            conn.execute(
                "insert into listing_photos (id, kind, submission_id, bucket, path, position)"
                " values (%s, 'original', %s, %s, %s, %s)",
                (photo_id, submission_id, s.private_bucket, path, position),
            )
    except (StorageError, psycopg.Error) as exc:
        storage.delete(s.private_bucket, uploaded)  # transaction rolls back; don't leave orphans
        log.exception("photo upload failed")
        raise HTTPException(503, "Could not save photos, please try again") from exc

    return SubmissionCreated(id=submission_id, ref_code=ref_code, status="received")


@router.get("/my/submissions")
def my_submissions(
    device_hash: str = Depends(device_token_hash),
    conn: psycopg.Connection = Depends(get_conn),
) -> list[MySubmission]:
    rows = conn.execute(
        """select s.id, s.ref_code, s.property_type, s.location, s.expected_price, s.status,
                  s.created_at,
                  case when l.state in ('published', 'sold') then l.id end as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where s.device_token_hash = %s order by s.created_at desc limit 50""",
        (device_hash,),
    ).fetchall()
    return [MySubmission(**r) for r in rows]
