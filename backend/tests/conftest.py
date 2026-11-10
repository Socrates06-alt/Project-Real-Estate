"""Shared test setup: a throwaway database, an API client, an admin login and helpers. Run: pytest -q"""

import os
import tempfile

tmp = tempfile.mkdtemp(prefix="nilayam-test-")
os.environ.update(
    DATABASE_PATH=f"{tmp}/test.db",
    MEDIA_DIR=f"{tmp}/media",
    ADMIN_PASSWORD="secret",
    CONSENT_VERSION="test-v1",
    SEMANTIC_SEARCH="false",  # tests plug in a small offline stand-in model where needed
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin(client):
    return {"Authorization": "Bearer " + client.post("/api/admin/login", json={"password": "secret"}).json()["token"]}
