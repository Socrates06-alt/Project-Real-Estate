"""Seller submissions: required fields, validation, photos and documentation help."""

import io

from PIL import Image

from app.listings.search import parse_query
from app.submissions.photos import sanitize
from tests.helpers import DEVICE, jpeg_with_gps, publish, submit


def test_address_and_description_are_optional_but_basics_required(client):
    assert submit(client, address="", description="").status_code == 201
    form = {k: v for k, v in [("seller_name", "No Photo"), ("seller_phone", "9447011111"), ("property_type", "land"),
            ("land_area_cents", "5"), ("location", "Kollam"), ("expected_price", "500000"), ("negotiable", "false"),
            ("documents_available", "false"), ("consent", "true"), ("consent_version", "test-v1")]}  # fmt: skip
    assert client.post("/api/submissions", data=form, headers=DEVICE).status_code == 201  # photos optional
    assert submit(client, seller_name="").status_code == 422
    assert submit(client, seller_phone="").status_code == 422
    assert submit(client, expected_price="").status_code == 422
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


def test_seller_can_ask_for_documentation_help(client, admin):
    sid = submit(client, wants_doc_help="true").json()["id"]
    assert client.get(f"/api/admin/properties/{sid}", headers=admin).json()["seller"]["wants_doc_help"] is True
    new = client.get("/api/admin/inbox", headers=admin).json()["new"]
    assert next(p for p in new if p["id"] == sid)["wants_doc_help"] is True
    plain = submit(client).json()["id"]
    assert client.get(f"/api/admin/properties/{plain}", headers=admin).json()["seller"]["wants_doc_help"] is False


def test_commercial_property_and_upgrade(client, admin):
    sid = submit(client, property_type="commercial", location="Kollam").json()["id"]
    lid = publish(client, admin, sid).json()["listing_id"]
    assert client.get(f"/api/listings/{lid}").json()["property_type"] == "commercial"
    found = [i["id"] for i in client.get("/api/listings", params={"type": "commercial", "limit": 50}).json()["items"]]
    assert lid in found
    assert lid in [i["id"] for i in client.get("/api/listings", params={"q": "shop kollam"}).json()["items"]]
