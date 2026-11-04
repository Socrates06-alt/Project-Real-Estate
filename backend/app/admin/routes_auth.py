"""Admin login: each founder's password -> a signed, expiring token."""

import hmac
import time

from fastapi import APIRouter, HTTPException, Request

from app.admin.schemas import LoginIn
from app.core.ratelimit import client_ip
from app.core.security import admin_passwords, login_limiter, make_token

router = APIRouter(prefix="/api/admin")


@router.post("/login")
def login(body: LoginIn, request: Request) -> dict:
    passwords = admin_passwords()
    if not passwords:
        raise HTTPException(503, "Admin is disabled: set ADMIN_PASSWORD")
    given = body.password.encode()
    # Check every password (no early exit) so timing doesn't reveal anything.
    ok = [hmac.compare_digest(given, p.encode()) for p in passwords]
    if not any(ok):
        login_limiter.hit(client_ip(request))  # only wrong attempts count
        time.sleep(0.5)  # slow down guessing
        raise HTTPException(401, "Wrong password")
    return {"token": make_token()}
