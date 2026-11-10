"""Visit requests: buyers ask to see a property; admins update the request."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import DB, now, one
from app.core.security import require_admin
from app.core.validation import OPEN_VISITS_SQL
from app.visits.schemas import VisitRequestIn, VisitUpdate

router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@router.post("/listings/{listing_id}/visit-requests", status_code=201)
def request_visit(listing_id: str, body: VisitRequestIn, db: DB) -> dict:
    if not one(db, "select 1 from listings where id = ? and state = 'published'", listing_id):
        raise HTTPException(404, "Listing not available for visits")
    existing = one(
        db,
        "select id, status from visit_requests"
        f" where listing_id = ? and phone = ? and status in {OPEN_VISITS_SQL}",
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


@admin_router.patch("/visits/{visit_id}")
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
