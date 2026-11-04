"""Dev only: load sample listings through the API so the app has something to show.

Usage (with the API running):  python seed_demo.py
"""

import io
import os
import random

import httpx
from PIL import Image, ImageDraw, ImageFilter

from app.core.config import get_settings

S = get_settings()
API = os.environ.get("SEED_API", "http://localhost:8000")
DEVICE = {"X-Device-Token": "demo_device_token_" + "x" * 30}

# (seller, phone, type, cents, location, description, price, negotiable, docs, docs note, public title, action)
PROPERTIES = [
    (
        "Thomas Mathew",
        "9847011223",
        "house",
        "8",
        "Chengannur town",
        "2-storey, 3 bedrooms, 1800 sq ft built-up. 12 ft tar road, 400 m from Chengannur railway station.",
        6200000,
        True,
        True,
        "Title deed, tax receipt",
        "Modern 3BHK villa near railway station",
        "publish",
    ),
    (
        "Saraswathy K",
        "9446055871",
        "land",
        "25",
        "Puliyoor",
        "Level plot, fenced on all sides. 10 ft road access. Well with good water all year.",
        4500000,
        False,
        True,
        "Title deed, survey sketch",
        "Fenced residential plot with well",
        "publish",
    ),
    (
        "Anitha Joseph",
        "9562033441",
        "house",
        "12",
        "Mulakuzha",
        "Single-storey 2BHK, 1100 sq ft, renovated 2024. Quiet road, 2 km to MC Road.",
        3800000,
        True,
        True,
        "",
        "Renovated 2BHK on a quiet road",
        "publish",
    ),
    (
        "Biju Varghese",
        "9961020345",
        "house",
        "5",
        "Budhanoor",
        "Single-storey, 2 bedrooms, 950 sq ft. Close to Budhanoor junction.",
        2900000,
        True,
        False,
        "",
        "Compact home near Budhanoor junction",
        "sold",
    ),
    (
        "Rajan Pillai",
        "9895077012",
        "land",
        "40",
        "Mulakuzha",
        "Rubber plantation, 40 cents. 14 ft road frontage. Old title deed, survey sketch available.",
        9000000,
        True,
        False,
        "",
        "",
        "new",
    ),
]


# Rough area centres for the demo (as if picked from place suggestions).
SAMPLE_SPOTS = {
    "Chengannur town": (9.3176, 76.6113),
    "Puliyoor": (9.3040, 76.5830),
    "Mulakuzha": (9.2990, 76.6420),
    "Budhanoor": (9.2870, 76.5640),
}


def placeholder_photo(seed: int, house: bool) -> bytes:
    """Simple illustrated scene (sky, trees, optional house) as a stand-in photo."""
    r = random.Random(seed)  # noqa: S311 - not security related
    w, h = 1200, 900
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    top, bottom = (r.randint(120, 170), r.randint(180, 210), 245), (250, 230, 200)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    d.rectangle([0, 560, w, h], fill=(r.randint(40, 80), r.randint(120, 160), r.randint(60, 90)))
    for _ in range(14):
        x, th = r.randint(0, w), r.randint(180, 330)
        d.line([(x, 600), (x + r.randint(-20, 20), 600 - th)], fill=(110, 80, 50), width=10)
        d.ellipse([x - 70, 600 - th - 50, x + 70, 600 - th + 30], fill=(30, r.randint(100, 130), 50))
    if house:
        d.rectangle([380, 380, 820, 640], fill=r.choice([(245, 240, 230), (250, 225, 190), (225, 235, 240)]))
        d.polygon([(340, 390), (600, 230), (860, 390)], fill=(170, 70, 50))
        d.rectangle([560, 500, 640, 640], fill=(110, 70, 45))
        for x in (420, 700):
            d.rectangle([x, 440, x + 80, 510], fill=(120, 170, 200))
    buf = io.BytesIO()
    img.filter(ImageFilter.GaussianBlur(1.2)).save(buf, "JPEG", quality=85)
    return buf.getvalue()


def main() -> None:
    login = httpx.post(f"{API}/api/admin/login", json={"password": S.admin_password})
    if login.status_code != 200:
        raise SystemExit("Admin login failed: set ADMIN_PASSWORD in .env and restart the API")
    admin = {"Authorization": f"Bearer {login.json()['token']}"}

    for i, (name, phone, ptype, cents, loc, desc, price, neg, docs, note, title, action) in enumerate(PROPERTIES):
        form = {
            "seller_name": name,
            "seller_phone": phone,
            "property_type": ptype,
            "land_area_cents": cents,
            "location": loc,
            "description": desc,
            "expected_price": str(price),
            "negotiable": str(neg).lower(),
            "documents_available": str(docs).lower(),
            "documents_note": note,
            "address": f"{name.split()[0]} Bhavan, {loc} P.O., Chengannur",
            **({"area_lat": SAMPLE_SPOTS[loc][0], "area_lng": SAMPLE_SPOTS[loc][1]} if loc in SAMPLE_SPOTS else {}),
            "consent": "true",
            "consent_version": S.consent_version,
        }
        photos = [
            ("photos", (f"{k}.jpg", placeholder_photo(i * 10 + k, ptype == "house" and k != 2), "image/jpeg"))
            for k in range(3)
        ]
        resp = httpx.post(f"{API}/api/submissions", data=form, files=photos, headers=DEVICE)
        resp.raise_for_status()
        if action == "new":
            continue
        sid = resp.json()["id"]
        form = httpx.get(f"{API}/api/admin/properties/{sid}", headers=admin).json()["form"]
        body = {**form, "title": title}  # area centre comes from the seller's chosen area
        res = httpx.post(f"{API}/api/admin/properties/{sid}/publish", json=body, headers=admin)
        res.raise_for_status()
        if action == "sold":
            httpx.post(f"{API}/api/admin/properties/{sid}/sold", headers=admin).raise_for_status()
        else:
            visit = {"name": "Anil Kumar", "phone": "9048012345", "preferred_time": "Sat 10 am", "budget": "₹60–70 L"}
            httpx.post(f"{API}/api/listings/{res.json()['listing_id']}/visit-requests", json=visit)
    print("Seeded demo listings.")


if __name__ == "__main__":
    main()
