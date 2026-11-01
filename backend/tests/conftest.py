import io
import os
import tempfile
import time
import uuid

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB:
    pytest.skip("TEST_DATABASE_URL not set", allow_module_level=True)

JWT_SECRET = "test-secret-" + "x" * 32
os.environ.update(
    DATABASE_URL=TEST_DB,
    SUPABASE_JWT_SECRET=JWT_SECRET,
    STORAGE_BACKEND="local",
    LOCAL_MEDIA_DIR=tempfile.mkdtemp(prefix="nilayam-media-"),
    CONSENT_VERSION="test-v1",
    TURNSTILE_SECRET="",
)

import jwt  # noqa: E402
import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db import migrate  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import limiter  # noqa: E402

TABLES = "audit_events, visit_requests, published_versions, listing_photos, listings, submissions, admins"


@pytest.fixture(scope="session", autouse=True)
def schema():
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute("drop schema public cascade; create schema public;")
    migrate(TEST_DB)


@pytest.fixture
def db():
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute(f"truncate {TABLES} cascade")
        yield conn


@pytest.fixture
def client(db):
    limiter.reset()
    with TestClient(app) as c:
        yield c


def make_token(user_id: uuid.UUID, exp_in: int = 3600, secret: str = JWT_SECRET) -> str:
    return jwt.encode(
        {"sub": str(user_id), "aud": "authenticated", "exp": int(time.time()) + exp_in},
        secret,
        algorithm="HS256",
    )


@pytest.fixture
def admin_headers(db):
    user_id = uuid.uuid4()
    db.execute("insert into admins (user_id, email) values (%s, 'founder@nilayam.in')", (user_id,))
    return {"Authorization": f"Bearer {make_token(user_id)}"}


def jpeg_with_gps() -> bytes:
    img = Image.new("RGB", (64, 48), "green")
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (9.0, 19.0, 0.0)}  # GPSInfo
    exif[0x010F] = "PhoneMaker"
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


DEVICE = {"X-Device-Token": "dev_" + "a" * 40}


def submission_form(**overrides) -> dict:
    form = {
        "seller_name": "Ravi Kumar",
        "seller_phone": "98470 12345",
        "property_type": "land",
        "land_area_cents": "12.5",
        "location": "Mulakuzha, Chengannur",
        "description": "Flat residential land with road access and good water.",
        "expected_price": "3000000",
        "negotiable": "true",
        "documents_available": "Title deed, tax receipt",
        "consent": "true",
        "consent_version": "test-v1",
    }
    form.update(overrides)
    return form


def submit(client, n_photos: int = 2, headers=DEVICE, **overrides):
    files = [("photos", (f"p{i}.jpg", jpeg_with_gps(), "image/jpeg")) for i in range(n_photos)]
    return client.post("/api/submissions", data=submission_form(**overrides), files=files, headers=headers)
