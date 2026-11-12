"""Sellers: submit a property (photos optional), and see "My listings" on the same device."""

import hashlib
import re
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.core.db import DB, many, now
from app.submissions import service
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
    service.check_consent(form)
    images = service.read_photos(photo_files)
    return service.create(db, form, device, images)


@router.get("/my/submissions")
def my_submissions(device: Annotated[str, Depends(device_hash)], db: DB) -> list[dict]:
    return many(
        db,
        """select s.id, s.number, s.property_type, s.location, s.expected_price, s.status, s.created_at,
                  s.plan, s.paid_at, s.ad_expires_at, s.payment_claimed_at,
                  case when l.state in ('published', 'sold') then l.id end as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where s.device_hash = ? order by s.created_at desc, s.number desc limit 50""",
        device,
    )


@router.post("/my/submissions/{submission_id}/payment-claim")
def claim_payment(submission_id: str, device: Annotated[str, Depends(device_hash)], db: DB) -> dict:
    """The seller says they paid (first time or a renewal); a founder checks the bank and confirms."""
    cur = db.execute(
        "update submissions set payment_claimed_at = ? where id = ? and device_hash = ? and plan != 'commission'",
        (now(), submission_id, device),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Listing not found")
    return {"ok": True}
