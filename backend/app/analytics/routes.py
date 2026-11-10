"""Visit counting: the app reports page views; admins see the numbers."""

import re
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import field_validator

from app.analytics import service
from app.core.db import DB
from app.core.ratelimit import RateLimiter, client_ip
from app.core.security import require_admin
from app.core.validation import Strict

# Generous for real people; stops a script from inflating the numbers.
track_limiter = RateLimiter(limit=600, window_seconds=3600)

router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


class ViewIn(Strict):
    page: Literal["home", "listing", "sell", "map", "profile", "legal", "other"]
    listing_id: str | None = None

    @field_validator("listing_id")
    @classmethod
    def _uuid(cls, v: str | None) -> str | None:
        return v if v is None or re.fullmatch(r"[0-9a-fA-F-]{36}", v) else None


@router.post("/track", status_code=204)
def track(body: ViewIn, request: Request, db: DB) -> Response:
    ip = client_ip(request)
    try:
        track_limiter.hit(ip)
    except Exception:
        return Response(status_code=204)  # over the limit: quietly not counted
    service.record(db, ip, request.headers.get("user-agent", ""), body.page, body.listing_id)
    return Response(status_code=204)


@admin_router.get("/stats")
def stats(db: DB) -> dict:
    return service.stats(db)
