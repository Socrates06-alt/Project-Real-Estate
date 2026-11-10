"""Search by meaning and typo tolerance (with an offline stand-in model)."""

import pytest

from app.core.config import get_settings
from app.semantic import engine
from tests.fake_model import FakeModel
from tests.helpers import publish, submit

LISTINGS = {
    "calm": "Calm area 200 m from St. Mary's school, good road access",
    "shop": "Commercial shop space at the busy junction",
    "river": "Rubber trees and a small stream, riverside view",
}


@pytest.fixture
def meaning(monkeypatch):
    """Switch the meaning model on (stand-in) with thresholds that suit it."""
    s = get_settings()
    monkeypatch.setattr(s, "semantic_min_score", 0.2)
    monkeypatch.setattr(s, "semantic_strong_score", 0.25)
    engine.use_model(FakeModel())
    yield
    engine.use_model(None)


def publish_with(client, admin, description, location="Kallissery", **sub):
    sid = submit(client, description=description, location=location, **sub).json()["id"]
    assert publish(client, admin, sid, description=description).status_code == 200
    return sid, client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]


def search(client, q):
    return [i["id"] for i in client.get("/api/listings", params={"q": q, "limit": 50}).json()["items"]]


def test_home_search_by_meaning(client, admin, meaning):
    types = {"shop": "commercial"}
    ids = {k: publish_with(client, admin, d, property_type=types.get(k, "land"))[1] for k, d in LISTINGS.items()}
    found = search(client, "quiet place near school")  # no word in common except "school"... and meaning
    assert found[0] == ids["calm"] and ids["shop"] not in found
    found = search(client, "purayidam near puzha")  # Malayalam words for land and river
    assert ids["river"] in found and ids["shop"] not in found
    # Price, type and size rules still apply on top.
    assert ids["calm"] not in search(client, "quiet place near school under 1 lakh")


def test_search_without_the_model_is_word_matching_with_small_typos(client, admin):
    sid, lid = publish_with(client, admin, "Plot facing the main road", location="Puliyoor")
    assert lid in search(client, "puliyur")  # small spelling difference
    assert lid in search(client, "road puliyoor")
    assert lid not in search(client, "quiet place near school")  # meaning needs the model


def test_private_seller_text_never_affects_public_search(client, admin, meaning):
    sid = submit(client, description="", address="Behind the river temple", location="Kallissery").json()["id"]
    assert publish(client, admin, sid, description="Level plot").status_code == 200
    lid = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]
    assert lid not in search(client, "river temple")
    # ...but admins can find it by those details.
    found = [p["id"] for p in client.get("/api/admin/properties", params={"q": "river temple"}, headers=admin).json()]
    assert sid in found


def test_admin_property_and_buyer_search_by_meaning(client, admin, meaning):
    sid = submit(client, description="Quiet plot close to the college", location="Kallissery").json()["id"]
    found = [p["id"] for p in client.get("/api/admin/properties", params={"q": "calm school"}, headers=admin).json()]
    assert sid in found
    b = client.post(
        "/api/admin/buyers",
        json={"name": "Varghese", "phones": ["9847066666"], "area": "Kallissery", "notes": "Needs an EMI plan"},
        headers=admin,
    ).json()
    found = [x["id"] for x in client.get("/api/admin/buyers", params={"q": "loan"}, headers=admin).json()]
    assert b["id"] in found


def test_backfill_embeds_records_saved_while_the_model_was_off(client, admin):
    from app.core.db import connect
    from app.semantic import store

    body = {"name": "Late Buyer", "phones": ["9847088888"], "area": "Ala", "notes": "riverside plot"}
    bid = client.post("/api/admin/buyers", json=body, headers=admin).json()["id"]
    engine.use_model(FakeModel())
    try:
        conn = connect()
        try:
            store.backfill(conn)
            conn.commit()
            assert conn.execute("select 1 from embeddings where kind = 'buyer' and ref_id = ?", (bid,)).fetchone()
        finally:
            conn.close()
    finally:
        engine.use_model(None)
