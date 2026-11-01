import uuid

import psycopg
import pytest

from tests.conftest import DEVICE, make_token, submit


def draft_and_publish(client, admin_headers, submission_id):
    listing = client.post(f"/api/admin/submissions/{submission_id}/draft", headers=admin_headers)
    assert listing.status_code == 201, listing.text
    lid = listing.json()["id"]
    r = client.post(f"/api/admin/listings/{lid}/publish", headers=admin_headers)
    assert r.status_code == 200, r.text
    return lid


def test_full_journey(client, admin_headers):
    # Seller submits
    r = submit(client)
    assert r.status_code == 201, r.text
    sub = r.json()
    assert sub["ref_code"].startswith("NLY-")

    mine = client.get("/api/my/submissions", headers=DEVICE).json()
    assert [m["status"] for m in mine] == ["received"]
    other_device = client.get("/api/my/submissions", headers={"X-Device-Token": "b" * 40}).json()
    assert other_device == []

    # Admin sees seller details + private photos
    detail = client.get(f"/api/admin/submissions/{sub['id']}", headers=admin_headers).json()
    assert detail["seller_phone"] == "+919847012345"
    assert "device_token_hash" not in detail
    assert len(detail["photos"]) == 2
    photo = client.get(detail["photos"][0]["url"], headers=admin_headers)
    assert photo.status_code == 200 and photo.headers["content-type"] == "image/webp"

    # Draft is not public until published
    lid = client.post(f"/api/admin/submissions/{sub['id']}/draft", headers=admin_headers).json()["id"]
    assert client.get(f"/api/listings/{lid}").status_code == 404

    r = client.patch(
        f"/api/admin/listings/{lid}",
        json={"title": "Residential plot near Mulakuzha", "photo_ids": [detail["photos"][1]["id"]]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert client.post(f"/api/admin/listings/{lid}/publish", headers=admin_headers).json()["version"] == 1

    # Public view is sanitized
    public = client.get(f"/api/listings/{lid}")
    assert public.status_code == 200
    body = public.text
    assert "Ravi" not in body and "9847012345" not in body
    data = public.json()
    assert data["status"] == "live" and len(data["photos"]) == 1
    assert data["number"] >= 1001 and data["documents_available"] is True
    assert client.get(data["photos"][0]).status_code == 200  # served from public bucket

    feed = client.get("/api/listings", params={"q": "land under 40 lakh mulakuzha"}).json()
    assert [i["id"] for i in feed["items"]] == [lid]
    assert client.get("/api/listings", params={"q": "house"}).json()["items"] == []

    assert client.get("/api/my/submissions", headers=DEVICE).json()[0]["listing_id"] == lid

    # Buyer requests a visit (deduplicated per phone)
    visit = {"name": "Anu", "phone": "9000000001", "preferred_time": "Saturday morning", "budget": "₹30–35 L"}
    v1 = client.post(f"/api/listings/{lid}/visit-requests", json=visit)
    v2 = client.post(f"/api/listings/{lid}/visit-requests", json=visit)
    assert v1.status_code == 201 and v1.json()["id"] == v2.json()["id"]

    visits = client.get("/api/admin/visits", headers=admin_headers).json()
    assert len(visits) == 1 and visits[0]["budget"] == "₹30–35 L"
    r = client.patch(f"/api/admin/visits/{visits[0]['id']}", json={"status": "scheduled"}, headers=admin_headers)
    assert r.json()["status"] == "scheduled"

    # Mark sold
    assert client.post(f"/api/admin/listings/{lid}/sold", headers=admin_headers).json()["state"] == "sold"
    assert client.get("/api/listings").json()["items"] == []
    assert client.get("/api/listings", params={"status": "sold"}).json()["items"][0]["status"] == "sold"
    assert client.post(f"/api/listings/{lid}/visit-requests", json=visit).status_code == 404
    assert client.get("/api/my/submissions", headers=DEVICE).json()[0]["status"] == "sold"


def test_admin_routes_require_admin(client, db):
    assert client.get("/api/admin/submissions").status_code == 401
    assert client.get("/api/admin/submissions", headers={"Authorization": "Bearer junk"}).status_code == 401
    expired = make_token(uuid.uuid4(), exp_in=-10)
    assert client.get("/api/admin/submissions", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    forged = make_token(uuid.uuid4(), secret="wrong-secret-" + "y" * 32)
    assert client.get("/api/admin/submissions", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    non_admin = make_token(uuid.uuid4())
    assert client.get("/api/admin/submissions", headers={"Authorization": f"Bearer {non_admin}"}).status_code == 403


def test_material_price_change_needs_seller_confirmation(client, admin_headers):
    sid = submit(client).json()["id"]
    lid = draft_and_publish(client, admin_headers, sid)

    client.patch(f"/api/admin/listings/{lid}", json={"price": 3_050_000}, headers=admin_headers)
    assert client.post(f"/api/admin/listings/{lid}/publish", headers=admin_headers).status_code == 200  # <5%

    client.patch(f"/api/admin/listings/{lid}", json={"price": 2_500_000}, headers=admin_headers)
    assert client.post(f"/api/admin/listings/{lid}/publish", headers=admin_headers).status_code == 409
    client.post(
        f"/api/admin/listings/{lid}/price-confirmation", json={"note": "Seller ok on call"}, headers=admin_headers
    )
    r = client.post(f"/api/admin/listings/{lid}/publish", headers=admin_headers)
    assert r.status_code == 200 and r.json()["version"] == 3
    assert client.get(f"/api/listings/{lid}").json()["price"] == 2_500_000

    versions = client.get(f"/api/admin/listings/{lid}", headers=admin_headers).json()["versions"]
    assert [v["snapshot"]["price"] for v in versions] == [2_500_000, 3_050_000, 3_000_000]


def test_originals_and_snapshots_are_immutable(client, admin_headers, db):
    sid = submit(client).json()["id"]
    draft_and_publish(client, admin_headers, sid)
    with pytest.raises(psycopg.errors.RaiseException):
        db.execute("update submissions set seller_phone = '+910000000000' where id = %s", (sid,))
    with pytest.raises(psycopg.errors.RaiseException):
        db.execute("delete from submissions where id = %s", (sid,))
    with pytest.raises(psycopg.errors.RaiseException):
        db.execute("update published_versions set snapshot = '{}'")


def test_submission_validation(client):
    from app.ratelimit import limiter

    assert submit(client, consent="false").status_code == 422
    assert submit(client, consent_version="old").status_code == 422
    assert submit(client, seller_phone="12345").status_code == 422
    limiter.reset()  # failed attempts also count toward the limit
    assert submit(client, n_photos=0).status_code == 422
    assert submit(client, n_photos=4).status_code == 422
    assert submit(client, headers={}).status_code == 422
    assert submit(client, headers={"X-Device-Token": "short"}).status_code == 400
    bad = [("photos", ("x.jpg", b"not an image", "image/jpeg"))]
    from tests.conftest import submission_form

    r = client.post("/api/submissions", data=submission_form(), files=bad, headers=DEVICE)
    assert r.status_code == 422


def test_reject_submission(client, admin_headers):
    sid = submit(client).json()["id"]
    r = client.post(f"/api/admin/submissions/{sid}/reject", json={"note": "Outside taluk"}, headers=admin_headers)
    assert r.status_code == 200
    assert client.post(f"/api/admin/submissions/{sid}/draft", headers=admin_headers).status_code == 409


def test_rate_limit_and_body_limit(client):
    for _ in range(5):
        assert submit(client, n_photos=1).status_code == 201
    assert submit(client, n_photos=1).status_code == 429

    big = b"0" * (27 * 1024 * 1024)
    r = client.post("/api/submissions", content=big, headers={**DEVICE, "Content-Type": "application/octet-stream"})
    assert r.status_code == 413
