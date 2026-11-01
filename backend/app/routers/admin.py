from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from psycopg.types.json import Jsonb

from app.config import get_settings
from app.db import get_conn
from app.schemas import ListingUpdate, NoteIn, VisitStatus, VisitUpdate
from app.security import Admin, require_admin
from app.storage import Storage, StorageError, get_storage

# Every route in this router requires a verified admin.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

SubmissionStatus = Literal["received", "under_review", "listed", "sold", "withdrawn", "rejected"]
ListingState = Literal["draft", "published", "sold", "withdrawn"]


def audit(conn: psycopg.Connection, admin: Admin, action: str, entity: str, entity_id, data: dict | None = None):
    conn.execute(
        "insert into audit_events (actor, action, entity, entity_id, data) values (%s, %s, %s, %s, %s)",
        (admin.user_id, action, entity, entity_id, Jsonb(data or {})),
    )


def set_submission_status(conn: psycopg.Connection, submission_id: UUID, status: str, note: str | None = None):
    conn.execute(
        "update submissions set status = %s, status_note = coalesce(%s, status_note),"
        " status_updated_at = now() where id = %s",
        (status, note, submission_id),
    )


def _listing(conn: psycopg.Connection, listing_id: UUID, lock: bool = False) -> dict:
    row = conn.execute(
        "select * from listings where id = %s" + (" for update" if lock else ""), (listing_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Listing not found")
    return row


# --- Submissions ----------------------------------------------------------


@router.get("/submissions")
def list_submissions(
    status: SubmissionStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    conn: psycopg.Connection = Depends(get_conn),
) -> list[dict]:
    return conn.execute(
        """select s.id, s.ref_code, s.seller_name, s.seller_phone, s.property_type, s.land_area_cents,
                  s.location, s.expected_price, s.status, s.created_at, l.id as listing_id
           from submissions s left join listings l on l.submission_id = s.id
           where (%(status)s::submission_status is null or s.status = %(status)s::submission_status)
           order by s.created_at desc limit %(limit)s offset %(offset)s""",
        {"status": status, "limit": limit, "offset": offset},
    ).fetchall()


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: UUID, conn: psycopg.Connection = Depends(get_conn)) -> dict:
    row = conn.execute(
        "select s.*, l.id as listing_id from submissions s"
        " left join listings l on l.submission_id = s.id where s.id = %s",
        (submission_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Submission not found")
    row.pop("device_token_hash")
    row.pop("ip_hash")
    photos = conn.execute(
        "select id, position from listing_photos where submission_id = %s and kind = 'original' order by position",
        (submission_id,),
    ).fetchall()
    row["photos"] = [{"id": p["id"], "url": f"/api/admin/photos/{p['id']}"} for p in photos]
    return row


@router.get("/photos/{photo_id}")
def get_private_photo(
    photo_id: UUID,
    conn: psycopg.Connection = Depends(get_conn),
    storage: Storage = Depends(get_storage),
) -> Response:
    row = conn.execute("select bucket, path from listing_photos where id = %s", (photo_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Photo not found")
    try:
        data = storage.get(row["bucket"], row["path"])
    except StorageError as exc:
        raise HTTPException(404, "Photo not found") from exc
    return Response(data, media_type="image/webp", headers={"Cache-Control": "private, max-age=300"})


@router.post("/submissions/{submission_id}/reject")
def reject_submission(
    submission_id: UUID,
    body: NoteIn,
    conn: psycopg.Connection = Depends(get_conn),
    admin: Admin = Depends(require_admin),
) -> dict:
    row = conn.execute(
        "select s.status, l.id as listing_id from submissions s"
        " left join listings l on l.submission_id = s.id where s.id = %s for update of s",
        (submission_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Submission not found")
    if row["listing_id"] or row["status"] not in ("received", "under_review"):
        raise HTTPException(409, "Only unlisted submissions can be rejected")
    set_submission_status(conn, submission_id, "rejected", body.note)
    audit(conn, admin, "submission.reject", "submission", submission_id, {"note": body.note})
    return {"id": submission_id, "status": "rejected"}


@router.post("/submissions/{submission_id}/draft", status_code=201)
def create_draft(
    submission_id: UUID,
    conn: psycopg.Connection = Depends(get_conn),
    admin: Admin = Depends(require_admin),
) -> dict:
    """Create the sanitized public draft. Seller identity and phone are never copied."""
    sub = conn.execute("select * from submissions where id = %s for update", (submission_id,)).fetchone()
    if sub is None:
        raise HTTPException(404, "Submission not found")
    if sub["status"] not in ("received", "under_review"):
        raise HTTPException(409, f"Submission is {sub['status']}")
    if conn.execute("select 1 from listings where submission_id = %s", (submission_id,)).fetchone():
        raise HTTPException(409, "Draft already exists")

    photo_ids = [
        r["id"]
        for r in conn.execute(
            "select id from listing_photos where submission_id = %s and kind = 'original' order by position",
            (submission_id,),
        )
    ]
    kind = "House" if sub["property_type"] == "house" else "Land"
    title = f"{kind} · {sub['land_area_cents'].normalize():f} cents · {sub['location']}"[:120]
    listing = conn.execute(
        """insert into listings (submission_id, title, property_type, land_area_cents, location,
               description, price, negotiable, documents_note, photo_ids)
           values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning *""",
        (
            submission_id,
            title,
            sub["property_type"],
            sub["land_area_cents"],
            sub["location"],
            sub["description"],
            sub["expected_price"],
            sub["negotiable"],
            sub["documents_available"],
            photo_ids,
        ),
    ).fetchone()
    set_submission_status(conn, submission_id, "under_review")
    audit(conn, admin, "listing.draft", "listing", listing["id"], {"submission_id": str(submission_id)})
    return listing


# --- Listings -------------------------------------------------------------


@router.get("/listings")
def list_listings(
    state: ListingState | None = None,
    conn: psycopg.Connection = Depends(get_conn),
) -> list[dict]:
    return conn.execute(
        """select id, submission_id, state, title, property_type, location, price, current_version,
                  published_at, sold_at, updated_at
           from listings where (%(s)s::listing_state is null or state = %(s)s::listing_state)
           order by updated_at desc limit 500""",
        {"s": state},
    ).fetchall()


@router.get("/listings/{listing_id}")
def get_listing(listing_id: UUID, conn: psycopg.Connection = Depends(get_conn)) -> dict:
    listing = _listing(conn, listing_id)
    listing["versions"] = conn.execute(
        "select version, published_at, published_by, snapshot from published_versions"
        " where listing_id = %s order by version desc",
        (listing_id,),
    ).fetchall()
    return listing


@router.patch("/listings/{listing_id}")
def update_listing(
    listing_id: UUID,
    body: ListingUpdate,
    conn: psycopg.Connection = Depends(get_conn),
    admin: Admin = Depends(require_admin),
) -> dict:
    listing = _listing(conn, listing_id, lock=True)
    if listing["state"] == "sold":
        raise HTTPException(409, "Sold listings cannot be edited")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return listing
    if None in changes.values():
        raise HTTPException(422, "Fields cannot be null")
    if "photo_ids" in changes:
        valid = {
            r["id"]
            for r in conn.execute(
                "select id from listing_photos where submission_id = %s and kind = 'original'",
                (listing["submission_id"],),
            )
        }
        if not set(changes["photo_ids"]) <= valid or len(set(changes["photo_ids"])) != len(changes["photo_ids"]):
            raise HTTPException(422, "photo_ids must be distinct photos from this submission")

    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    updated = conn.execute(
        f"update listings set {sets}, updated_at = now() where id = %(id)s returning *",
        {**{k: (v.value if hasattr(v, "value") else v) for k, v in changes.items()}, "id": listing_id},
    ).fetchone()
    audit(conn, admin, "listing.update", "listing", listing_id, {"fields": sorted(changes)})
    return updated


@router.post("/listings/{listing_id}/price-confirmation")
def confirm_price(
    listing_id: UUID,
    body: NoteIn,
    conn: psycopg.Connection = Depends(get_conn),
    admin: Admin = Depends(require_admin),
) -> dict:
    """Record that the seller confirmed the listing's *current* price (e.g. by call/WhatsApp)."""
    listing = _listing(conn, listing_id, lock=True)
    conn.execute(
        "update listings set confirmed_price = price, price_confirmed_at = now(),"
        " price_confirmation_note = %s, updated_at = now() where id = %s",
        (body.note, listing_id),
    )
    audit(conn, admin, "listing.price_confirmed", "listing", listing_id, {"price": listing["price"], "note": body.note})
    return {"id": listing_id, "confirmed_price": listing["price"]}


def _reference_price(conn: psycopg.Connection, listing: dict) -> int:
    if listing["current_version"]:
        snap = conn.execute(
            "select snapshot from published_versions where listing_id = %s and version = %s",
            (listing["id"], listing["current_version"]),
        ).fetchone()["snapshot"]
        return int(snap["price"])
    return conn.execute("select expected_price from submissions where id = %s", (listing["submission_id"],)).fetchone()[
        "expected_price"
    ]


def _publish_photos(conn: psycopg.Connection, storage: Storage, listing: dict) -> list[str]:
    """Copy selected (already sanitized) originals to the public bucket. Idempotent."""
    s = get_settings()
    urls = []
    for position, src_id in enumerate(listing["photo_ids"]):
        pub = conn.execute(
            "select bucket, path from listing_photos"
            " where listing_id = %s and source_photo_id = %s and kind = 'public'",
            (listing["id"], src_id),
        ).fetchone()
        if pub is None:
            src = conn.execute("select bucket, path from listing_photos where id = %s", (src_id,)).fetchone()
            path = f"{listing['id']}/{src_id}.webp"
            storage.put(s.public_bucket, path, storage.get(src["bucket"], src["path"]), "image/webp")
            conn.execute(
                "insert into listing_photos (kind, listing_id, source_photo_id, bucket, path, position)"
                " values ('public', %s, %s, %s, %s, %s)",
                (listing["id"], src_id, s.public_bucket, path, position),
            )
            pub = {"bucket": s.public_bucket, "path": path}
        urls.append(storage.public_url(pub["bucket"], pub["path"]))
    return urls


@router.post("/listings/{listing_id}/publish")
def publish_listing(
    listing_id: UUID,
    conn: psycopg.Connection = Depends(get_conn),
    storage: Storage = Depends(get_storage),
    admin: Admin = Depends(require_admin),
) -> dict:
    listing = _listing(conn, listing_id, lock=True)
    if listing["state"] == "sold":
        raise HTTPException(409, "Listing is already sold")
    if not listing["photo_ids"]:
        raise HTTPException(422, "Select at least one photo before publishing")

    reference = _reference_price(conn, listing)
    change_pct = abs(listing["price"] - reference) * 100 / reference
    if change_pct > get_settings().material_price_change_pct and listing["confirmed_price"] != listing["price"]:
        raise HTTPException(
            409,
            f"Price differs {change_pct:.1f}% from {reference}; record seller confirmation first",
        )

    try:
        photos = _publish_photos(conn, storage, listing)
    except StorageError as exc:
        raise HTTPException(503, "Could not publish photos, please retry") from exc

    version = listing["current_version"] + 1
    snapshot = {
        "title": listing["title"],
        "property_type": listing["property_type"],
        "land_area_cents": float(listing["land_area_cents"]),
        "location": listing["location"],
        "description": listing["description"],
        "price": listing["price"],
        "negotiable": listing["negotiable"],
        "documents_note": listing["documents_note"],
        "photos": photos,
    }
    conn.execute(
        "insert into published_versions (listing_id, version, snapshot, published_by) values (%s, %s, %s, %s)",
        (listing_id, version, Jsonb(snapshot), admin.user_id),
    )
    conn.execute(
        "update listings set state = 'published', current_version = %s, published_at = now(),"
        " updated_at = now() where id = %s",
        (version, listing_id),
    )
    set_submission_status(conn, listing["submission_id"], "listed")
    audit(conn, admin, "listing.publish", "listing", listing_id, {"version": version})
    return {"id": listing_id, "state": "published", "version": version, "snapshot": snapshot}


def _transition(conn, admin, listing_id: UUID, to: str, submission_status: str, extra_sql: str = "") -> dict:
    listing = _listing(conn, listing_id, lock=True)
    if listing["state"] != "published":
        raise HTTPException(409, f"Listing is {listing['state']}, not published")
    conn.execute(f"update listings set state = %s, updated_at = now(){extra_sql} where id = %s", (to, listing_id))
    set_submission_status(conn, listing["submission_id"], submission_status)
    audit(conn, admin, f"listing.{to}", "listing", listing_id)
    return {"id": listing_id, "state": to}


@router.post("/listings/{listing_id}/sold")
def mark_sold(listing_id: UUID, conn=Depends(get_conn), admin: Admin = Depends(require_admin)) -> dict:
    return _transition(conn, admin, listing_id, "sold", "sold", ", sold_at = now()")


@router.post("/listings/{listing_id}/withdraw")
def withdraw(listing_id: UUID, conn=Depends(get_conn), admin: Admin = Depends(require_admin)) -> dict:
    return _transition(conn, admin, listing_id, "withdrawn", "withdrawn")


# --- Visits ---------------------------------------------------------------


@router.get("/visits")
def list_visits(
    status: VisitStatus | None = None,
    listing_id: UUID | None = None,
    conn: psycopg.Connection = Depends(get_conn),
) -> list[dict]:
    return conn.execute(
        """select v.*, l.title as listing_title from visit_requests v join listings l on l.id = v.listing_id
           where (%(st)s::visit_status is null or v.status = %(st)s::visit_status)
             and (%(lid)s::uuid is null or v.listing_id = %(lid)s::uuid)
           order by v.created_at desc limit 500""",
        {"st": status.value if status else None, "lid": listing_id},
    ).fetchall()


@router.patch("/visits/{visit_id}")
def update_visit(
    visit_id: UUID,
    body: VisitUpdate,
    conn: psycopg.Connection = Depends(get_conn),
    admin: Admin = Depends(require_admin),
) -> dict:
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        raise HTTPException(422, "Nothing to update")
    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    row = conn.execute(
        f"update visit_requests set {sets}, updated_at = now() where id = %(id)s returning *",
        {**{k: (v.value if hasattr(v, "value") else v) for k, v in changes.items()}, "id": visit_id},
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Visit request not found")
    audit(conn, admin, "visit.update", "visit_request", visit_id, {"fields": sorted(changes)})
    return row
