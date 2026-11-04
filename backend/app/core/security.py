"""Admin sign-in tokens, the login attempt limit, and live-server setting checks."""

import hashlib
import hmac
import re
import time

from fastapi import Header, HTTPException

from app.core.config import Settings, get_settings
from app.core.ratelimit import RateLimiter

TOKEN_TTL = 7 * 24 * 3600

# 10 wrong passwords per 15 minutes per network address, then locked out for the rest of the window.
login_limiter = RateLimiter(
    limit=10, window_seconds=15 * 60, message="Too many login attempts. Please wait 15 minutes."
)


def admin_passwords() -> list[str]:
    """Each founder's password (ADMIN_PASSWORD, ADMIN_PASSWORD_2)."""
    s = get_settings()
    return [p for p in (s.admin_password, s.admin_password_2) if p]


def _key() -> bytes:
    # Changing any password signs everyone out.
    return hashlib.sha256(b"nilayam-admin:" + "\n".join(admin_passwords()).encode()).digest()


def make_token() -> str:
    exp = str(int(time.time()) + TOKEN_TTL)
    return f"{exp}.{hmac.new(_key(), exp.encode(), hashlib.sha256).hexdigest()}"


def require_admin(authorization: str | None = Header(None)) -> None:
    """FastAPI dependency for every admin endpoint."""
    if not admin_passwords():
        raise HTTPException(503, "Admin is disabled: set ADMIN_PASSWORD")
    token = (authorization or "").removeprefix("Bearer ").strip()
    exp, _, sig = token.partition(".")
    expected = hmac.new(_key(), exp.encode(), hashlib.sha256).hexdigest()
    if not (exp.isdigit() and hmac.compare_digest(sig, expected) and int(exp) > time.time()):
        raise HTTPException(401, "Not authenticated")


WEAK = {"change-me", "demo123", "secret", "password", "admin"}


def check_production(settings: Settings) -> None:
    """On the live server, refuse to start with weak admin passwords or the placeholder phone number."""
    if not settings.production:
        return
    problems = []
    for name in ("admin_password", "admin_password_2"):
        pw = getattr(settings, name)
        if name == "admin_password" or pw:
            if len(pw) < 12 or pw.lower() in WEAK:
                problems.append(f"{name.upper()} must be at least 12 characters and not a sample password")
    for name in ("contact_phone", "contact_whatsapp"):
        number = getattr(settings, name).replace(" ", "")
        if not re.fullmatch(r"\+\d{11,14}", number) or "9999999999" in number:
            problems.append(f"Set {name.upper()} to your real number with country code, e.g. +919847012345")
    if problems:
        raise RuntimeError("Production settings not ready:\n - " + "\n - ".join(problems))
