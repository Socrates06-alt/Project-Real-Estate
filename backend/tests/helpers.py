"""Test helpers: a sample seller submission, publishing, and a photo with GPS data."""

import io

from PIL import Image

DEVICE = {"X-Device-Token": "d" * 40}


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


def admin_form_data(**overrides):
    """A property as a founder enters it in admin (seller agreed to the terms)."""
    return {
        "seller_name": "Mary Thomas", "seller_phone": "9446012345", "property_type": "house",
        "land_area_cents": "8", "location": "Puliyoor", "address": "Thekkethil House", "description": "2BHK",
        "expected_price": "4500000", "negotiable": "true", "documents_available": "false",
        "consent": "true", "consent_version": "test-v1", **overrides,
    }  # fmt: skip
