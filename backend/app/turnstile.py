import httpx
from fastapi import HTTPException

from app.config import get_settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(token: str | None, ip: str) -> None:
    """No-op unless TURNSTILE_SECRET is configured."""
    secret = get_settings().turnstile_secret
    if not secret:
        return
    if not token:
        raise HTTPException(400, "Captcha required")
    try:
        resp = httpx.post(VERIFY_URL, data={"secret": secret, "response": token, "remoteip": ip}, timeout=10)
        ok = resp.json().get("success") is True
    except (httpx.HTTPError, ValueError):
        ok = False
    if not ok:
        raise HTTPException(400, "Captcha verification failed")
