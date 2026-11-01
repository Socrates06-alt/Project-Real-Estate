import hashlib
import re
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
import psycopg
from fastapi import Depends, Header, HTTPException, Request

from app.config import get_settings
from app.db import get_conn

_DEVICE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,128}$")


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy_headers:
        ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-real-ip")
        if ip:
            return ip
    return request.client.host if request.client else "unknown"


def ip_hash(request: Request) -> str:
    return sha256(get_settings().ip_hash_salt + client_ip(request))


def device_token_hash(x_device_token: str = Header(...)) -> str:
    """Anonymous per-device identity for 'My Listings'. Only the hash is stored."""
    if not _DEVICE_TOKEN_RE.match(x_device_token):
        raise HTTPException(400, "Invalid device token")
    return sha256(x_device_token)


# --- Admin auth ------------------------------------------------------------


@dataclass(frozen=True)
class Admin:
    user_id: UUID
    email: str


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json")


def decode_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256" and settings.supabase_jwt_secret:
            key = settings.supabase_jwt_secret
        elif alg in ("RS256", "ES256") and settings.supabase_url:
            key = _jwks_client().get_signing_key_from_jwt(token).key
        else:
            raise jwt.InvalidTokenError("unsupported algorithm")
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated", options={"require": ["exp", "sub"]})
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid or expired token") from exc


def require_admin(
    authorization: str | None = Header(None),
    conn: psycopg.Connection = Depends(get_conn),
) -> Admin:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    claims = decode_supabase_jwt(authorization[7:].strip())
    try:
        user_id = UUID(claims["sub"])
    except ValueError as exc:
        raise HTTPException(401, "Invalid token subject") from exc
    row = conn.execute("select user_id, email from admins where user_id = %s", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(403, "Not an admin")
    return Admin(user_id=row["user_id"], email=row["email"])
