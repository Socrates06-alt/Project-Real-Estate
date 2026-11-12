"""'Call me back': someone leaves just a name and number (to sell or to buy) and a founder calls them."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.db import DB, many, now
from app.core.ratelimit import RateLimiter, client_ip
from app.core.security import require_admin
from app.core.validation import Name, Phone, Source, Strict

router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])
callback_limiter = RateLimiter(limit=10, window_seconds=3600, message="Too many requests. Please try again later.")


class CallbackIn(Strict):
    name: Name
    phone: Phone
    want: Literal["sell", "buy", ""] = ""
    came_from: Source = ""


@router.post("/callbacks", status_code=201)
def ask_for_call(body: CallbackIn, request: Request, db: DB) -> dict:
    callback_limiter.hit(client_ip(request))
    # The same number asking again while still waiting: refresh it instead of adding a second one.
    waiting = db.execute("select id from callbacks where phone = ? and done_at is null", (body.phone,)).fetchone()
    if waiting:
        db.execute(
            "update callbacks set name = ?, want = ?, came_from = ?, created_at = ? where id = ?",
            (body.name, body.want, body.came_from, now(), waiting[0]),
        )
    else:
        db.execute(
            "insert into callbacks (id, name, phone, want, came_from) values (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), body.name, body.phone, body.want, body.came_from),
        )
    return {"ok": True}


@admin_router.get("/callbacks")
def waiting_callbacks(db: DB) -> list[dict]:
    """People waiting for a call, newest first."""
    return many(db, "select * from callbacks where done_at is null order by created_at desc limit 200")


@admin_router.post("/callbacks/{callback_id}/done")
def mark_called(callback_id: str, db: DB) -> dict:
    if db.execute("update callbacks set done_at = ? where id = ?", (now(), callback_id)).rowcount == 0:
        raise HTTPException(404, "Not found")
    return {"id": callback_id, "done": True}
