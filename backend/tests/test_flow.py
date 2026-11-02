"""Key flows against a throwaway SQLite database. Run: pytest -q"""

import io
import os
import sqlite3
import tempfile

tmp = tempfile.mkdtemp(prefix="nilayam-test-")
os.environ.update(
    DATABASE_PATH=f"{tmp}/test.db", MEDIA_DIR=f"{tmp}/media", ADMIN_PASSWORD="secret", CONSENT_VERSION="test-v1"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402
from app.photos import sanitize  # noqa: E402
from app.search import parse_query  # noqa: E402

DEVICE = {"X-Device-Token": "d" * 40}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    return {"Authorization": "Bearer " + client.post("/api/admin/login", json={"password": "secret"}).json()["token"]}


def jpeg_with_gps() -> bytes:
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (9.0, 19.0, 0.0)}  # GPS
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), "green").save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def submit(client, **overrides):
    form = {
        "seller_name": "Ravi Kumar", "seller_phone": "98470 12345", "property_type": "land",
        "land_area_cents": "12.5", "location": "Mulakuzha", "address": "Kizhakkethil House, Mulakuzha P.O.",
        "description": "Flat land with road access.",
        "expected_price": "3000000", "negotiable": "true", "documents_available": "true",
        "documents_note": "Title deed", "consent": "true", "consent_version": "test-v1", **overrides,
    }  # fmt: skip
    files = [("photos", ("p.jpg", jpeg_with_gps(), "image/jpeg"))]
    return client.post("/api/submissions", data=form, files=files, headers=DEVICE)


def publish(client, admin, sid: str, **changes):
    form = {**client.get(f"/api/admin/properties/{sid}", headers=admin).json()["form"], **changes}
    return client.post(f"/api/admin/properties/{sid}/publish", json=form, headers=admin)


def publish_new(client, admin) -> str:
    sid = submit(client).json()["id"]
    assert publish(client, admin, sid).status_code == 200
    return sid


def test_full_journey(client, admin):
    sub = submit(client).json()
    sid = sub["id"]
    assert sub["number"] >= 1001
    assert client.get("/api/my/submissions", headers=DEVICE).json()[0]["status"] == "received"
    inbox = client.get("/api/admin/inbox", headers=admin).json()
    assert sid in [p["id"] for p in inbox["new"]]

    # Property page: seller details for the founder, a ready form without seller identity.
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert prop["seller"]["seller_phone"] == "+919847012345" and prop["group"] == "new"
    assert "Ravi" not in str(prop["form"])

    res = publish(client, admin, sid, title="Plot near Mulakuzha").json()
    lid = res["listing_id"]
    assert res["group"] == "live" and res["number"] == sub["number"]

    page = client.get(f"/api/listings/{lid}")
    assert "Ravi" not in page.text and "9847012345" not in page.text  # seller stays private
    data = page.json()
    assert data["title"] == "Plot near Mulakuzha" and data["negotiable"] is True
    assert data["number"] == sub["number"]  # one number from submission to buyer
    assert client.get(data["photos"][0]).status_code == 200
    found = client.get("/api/listings", params={"q": "land under 40 lakh mulakuzha"}).json()["items"]
    assert lid in [i["id"] for i in found]
    assert lid not in [i["id"] for i in client.get("/api/listings", params={"q": "house"}).json()["items"]]

    visit = {"name": "Anu", "phone": "9000000001", "budget": "₹30 L"}
    assert client.post(f"/api/listings/{lid}/visit-requests", json=visit).status_code == 201
    visits = client.get("/api/admin/inbox", headers=admin).json()["visits"]
    v = next(v for v in visits if v["property_id"] == sid)
    assert client.patch(f"/api/admin/visits/{v['id']}", json={"status": "scheduled"}, headers=admin).status_code == 200

    assert client.post(f"/api/admin/properties/{sid}/sold", headers=admin).json()["group"] == "sold"
    assert client.get(f"/api/listings/{lid}").json()["status"] == "sold"
    assert client.post(f"/api/listings/{lid}/visit-requests", json=visit).status_code == 404


def test_admin_search_by_number_phone_or_name(client, admin):
    sub = submit(client, seller_name="Meera Nair", seller_phone="94470 55555").json()

    def found(q):
        rows = client.get("/api/admin/properties", params={"q": q}, headers=admin).json()
        return sub["id"] in [r["id"] for r in rows]

    assert found(str(sub["number"])) and found(f"#{sub['number']}")
    assert found("9447055555") and found("+91 94470 55555") and found("094470-55555")
    assert found("meera")
    assert not found("nobody-like-this")


def test_admin_requires_login(client):
    assert client.post("/api/admin/login", json={"password": "wrong"}).status_code == 401
    assert client.get("/api/admin/inbox").status_code == 401
    assert client.get("/api/admin/inbox", headers={"Authorization": "Bearer 9999999999.fake"}).status_code == 401


def test_price_change_needs_seller_confirmation(client, admin):
    sid = publish_new(client, admin)
    assert publish(client, admin, sid, price=2_950_000).status_code == 200  # small change is fine
    res = publish(client, admin, sid, price=2_500_000)
    assert res.status_code == 409 and res.json()["detail"] == "PRICE_NEEDS_SELLER_CONFIRMATION"
    assert publish(client, admin, sid, price=2_500_000, seller_confirmed=True).status_code == 200


def test_not_listed_and_take_down(client, admin):
    sid = submit(client).json()["id"]
    assert (
        client.post(f"/api/admin/properties/{sid}/not-listed", json={}, headers=admin).json()["group"] == "not_listed"
    )
    sid2 = publish_new(client, admin)
    assert client.post(f"/api/admin/properties/{sid2}/take-down", headers=admin).json()["group"] == "not_listed"
    counts = client.get("/api/admin/inbox", headers=admin).json()["counts"]
    assert counts["not_listed"] >= 2


def test_originals_and_snapshots_are_immutable(client, admin):
    sid = publish_new(client, admin)
    lid = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]
    # Autocommit mode + close, so a blocked write never leaves a lock behind for later tests.
    db = sqlite3.connect(os.environ["DATABASE_PATH"], isolation_level=None)
    try:
        for sql in (
            "update submissions set seller_phone = 'x'",
            "delete from submissions",
            f"update published_versions set snapshot = '{{}}' where listing_id = '{lid}'",
        ):
            with pytest.raises(sqlite3.IntegrityError):
                db.execute(sql)
    finally:
        db.close()


def test_address_and_description_are_optional_but_basics_required(client):
    assert submit(client, address="", description="").status_code == 201
    assert submit(client, location="").status_code == 422
    assert submit(client, land_area_cents="").status_code == 422
    assert submit(client, property_type="").status_code == 422


def test_submission_validation(client):
    assert submit(client, consent="false").status_code == 422
    assert submit(client, seller_phone="12345").status_code == 422
    bad = [("photos", ("x.jpg", b"not an image", "image/jpeg"))]
    assert client.post("/api/submissions", data={}, files=bad, headers=DEVICE).status_code == 422


def test_photo_metadata_stripped_and_search_parser():
    with Image.open(io.BytesIO(sanitize(jpeg_with_gps()))) as img:
        assert img.format == "WEBP" and not img.getexif()
    p = parse_query("House under 40 lakh near Mulakuzha 10 cents")
    assert (p.property_type, p.max_price, p.min_cents, p.text) == ("house", 4_000_000, 10, "mulakuzha")


PULIYOOR = (9.3040, 76.5830)
ALA = (9.3300, 76.5950)  # ~3 km from Puliyoor
VENMONY = (9.2560, 76.6460)  # ~8.5 km from Puliyoor


def publish_in_area(client, admin, area, name):
    sid = submit(client, location=name, area_lat=str(area[0]), area_lng=str(area[1])).json()["id"]
    res = publish(client, admin, sid).json()  # form defaults to the seller's chosen area
    return sid, res["listing_id"]


def test_area_search_finds_by_area_and_never_reveals_location(client, admin):
    from app.public import area_search_limiter

    area_search_limiter.reset()
    sid, p1 = publish_in_area(client, admin, PULIYOOR, "Puliyoor")
    _, p2 = publish_in_area(client, admin, PULIYOOR, "Puliyoor")
    _, a1 = publish_in_area(client, admin, ALA, "Ala")
    _, v1 = publish_in_area(client, admin, VENMONY, "Venmony")

    # Private address only in admin.
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert prop["seller"]["address"].startswith("Kizhakkethil")

    def search(km):
        return client.get("/api/listings", params={"lat": PULIYOOR[0], "lng": PULIYOOR[1], "radius_km": km}).json()

    r5 = search(5)
    ids5 = [i["id"] for i in r5["items"]]
    assert {p1, p2, a1} <= set(ids5) and v1 not in ids5
    # Nearest area first (both Puliyoor ones before Ala), newest first within Puliyoor.
    assert ids5.index(p2) < ids5.index(p1) < ids5.index(a1)
    assert v1 in [i["id"] for i in search(10)["items"]]

    # No coordinates, distances or address in anything buyers can load.
    for item in [*r5["items"], client.get(f"/api/listings/{p1}").json()]:
        assert not {"lat", "lng", "public_lat", "public_lng", "distance_km", "address"} & item.keys()
    assert "Kizhakkethil" not in client.get(f"/api/listings/{p1}").text


def test_area_search_is_rate_limited(client):
    from app.public import area_search_limiter

    area_search_limiter.reset()
    area_search_limiter.limit = 3
    try:
        params = {"lat": PULIYOOR[0], "lng": PULIYOOR[1], "radius_km": 5}
        codes = [client.get("/api/listings", params=params).status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]
        assert client.get("/api/listings").status_code == 200  # normal browsing is not limited
    finally:
        area_search_limiter.limit = 300
        area_search_limiter.reset()


def test_grid_flag_is_shared_within_an_area():
    from app.geo import flag

    assert flag(9.30401, 76.58302) == flag(9.30455, 76.58377)  # two spots in the same ~1 km square


def test_home_badges_and_documents_filter(client, admin):
    sid = submit(client, location="Ennakkad", documents_available="true").json()["id"]
    lid = publish(client, admin, sid).json()["listing_id"]
    item = client.get(f"/api/listings/{lid}").json()
    assert item["listed_at"] and item["price_reduced"] is False

    publish(client, admin, sid, price=2_900_000)  # small drop, no confirmation needed
    assert client.get(f"/api/listings/{lid}").json()["price_reduced"] is True

    nodocs = submit(client, location="Ennakkad", documents_available="false").json()["id"]
    nodocs_lid = publish(client, admin, nodocs).json()["listing_id"]
    with_docs = [i["id"] for i in client.get("/api/listings", params={"docs": True, "limit": 50}).json()["items"]]
    assert lid in with_docs and nodocs_lid not in with_docs
