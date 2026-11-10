"""TEMPORARY one-time tool: clean up every live listing's text into good English (Sarvam AI).

For each live listing: preview (before -> after), then apply (republished as a new version, like Save).
Price, size, photos and area stay as they are. To remove the tool later: delete this folder, the router line in
app/main.py, and the admin Clean-up page and its Inbox button.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.admin import service
from app.admin.schemas import PublishIn
from app.cleanup import sarvam
from app.core.db import DB, many, one
from app.core.security import require_admin
from app.core.validation import Strict

router = APIRouter(prefix="/api/admin/cleanup", dependencies=[Depends(require_admin)])

_LIMITS = {"title": (5, 120), "location": (2, 120), "description": (0, 4000), "documents_note": (0, 500)}


def _listing(db, submission_id: str) -> dict:
    listing = one(
        db,
        "select l.* from listings l join submissions s on s.id = l.submission_id"
        " where l.submission_id = ? and l.state = 'published' and s.removed_at is null",
        submission_id,
    )
    if listing is None:
        raise HTTPException(404, "Not a live listing")
    return listing


def _safe(old: str, new: str, field: str) -> str:
    """Use the cleaned text only if it fits the field; otherwise keep the original."""
    lo, hi = _LIMITS[field]
    new = (new or "").strip()
    if field == "title" and not new:
        return old
    return new if lo <= len(new) <= hi else old


@router.get("")
def status(db: DB) -> dict:
    rows = many(
        db,
        """select l.submission_id as id, l.number, l.title, l.location from listings l
           join submissions s on s.id = l.submission_id
           where l.state = 'published' and s.removed_at is null order by l.number""",
    )
    return {"enabled": sarvam.enabled(), "listings": rows}


@router.post("/{submission_id}/preview")
def preview(submission_id: str, db: DB) -> dict:
    listing = _listing(db, submission_id)
    before = {k: listing[k] or "" for k in sarvam.FIELDS}
    try:
        cleaned = sarvam.clean(before)
    except sarvam.CleanupError as exc:
        raise HTTPException(502, str(exc)) from exc
    after = {k: _safe(before[k], cleaned[k], k) for k in sarvam.FIELDS}
    return {"id": submission_id, "number": listing["number"], "before": before, "after": after}


class ApplyIn(Strict):
    title: str
    location: str
    description: str = ""
    documents_note: str = ""


@router.post("/{submission_id}/apply")
def apply(submission_id: str, body: ApplyIn, db: DB) -> dict:
    listing = _listing(db, submission_id)
    form = {k: listing[k] for k in service.PUBLIC_FIELDS}
    form.update(lat=listing["lat"], lng=listing["lng"])
    form.update({k: _safe(listing[k] or "", getattr(body, k), k) for k in sarvam.FIELDS})
    return service.publish(db, submission_id, PublishIn(**form))
