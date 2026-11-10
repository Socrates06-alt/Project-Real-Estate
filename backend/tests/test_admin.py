"""Admin: search, login, price checks, actions and production settings."""

import pytest

from tests.helpers import DEVICE, jpeg_with_gps, publish, publish_new, submit


def test_admin_search_by_number_phone_or_name(client, admin):
    sub = submit(client, seller_name="Meera Nair", seller_phone="94470 55555").json()

    def found(q):
        rows = client.get("/api/admin/properties", params={"q": q}, headers=admin).json()
        return sub["id"] in [r["id"] for r in rows]

    assert found(str(sub["number"])) and found(f"#{sub['number']}")
    assert found("9447055555") and found("+91 94470 55555") and found("094470-55555")
    assert found("meera")
    lid = publish(client, admin, sub["id"]).json()["listing_id"]
    assert found(f"http://localhost:5173/p/{lid}")  # link from a buyer's WhatsApp message
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


def test_admin_can_add_photos_when_seller_did_not(client, admin):
    form = {"seller_name": "No Pics", "seller_phone": "9447033333", "property_type": "land", "land_area_cents": "5",
            "location": "Kollam", "expected_price": "500000", "negotiable": "false", "documents_available": "false",
            "consent": "true", "consent_version": "test-v1"}  # fmt: skip
    sid = client.post("/api/submissions", data=form, headers=DEVICE).json()["id"]
    assert client.get(f"/api/admin/properties/{sid}", headers=admin).json()["photos"] == []
    files = [("photos", ("a.jpg", jpeg_with_gps(), "image/jpeg"))]
    res = client.post(f"/api/admin/properties/{sid}/photos", files=files, headers=admin)
    assert res.status_code == 201 and len(res.json()["photos"]) == 1
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert len(prop["photos"]) == 1
    lid = publish(client, admin, sid, photo_ids=[prop["photos"][0]["id"]]).json()["listing_id"]
    assert len(client.get(f"/api/listings/{lid}").json()["photos"]) == 1
    too_many = [("photos", (f"{i}.jpg", jpeg_with_gps(), "image/jpeg")) for i in range(3)]
    assert client.post(f"/api/admin/properties/{sid}/photos", files=too_many, headers=admin).status_code == 422


def test_second_founder_password_and_login_lockout(client, monkeypatch):
    from app.core.config import get_settings
    from app.core.security import login_limiter

    monkeypatch.setattr(get_settings(), "admin_password_2", "founder-two-pass")
    login_limiter.reset()
    try:
        ok = client.post("/api/admin/login", json={"password": "founder-two-pass"})
        assert ok.status_code == 200
        headers = {"Authorization": "Bearer " + ok.json()["token"]}
        assert client.get("/api/admin/inbox", headers=headers).status_code == 200

        monkeypatch.setattr("app.admin.routes_auth.time.sleep", lambda _: None)
        codes = [client.post("/api/admin/login", json={"password": "wrong"}).status_code for _ in range(11)]
        assert codes[:10] == [401] * 10 and codes[10] == 429
    finally:
        login_limiter.reset()


def test_production_refuses_weak_settings():
    from app.core.config import Settings
    from app.core.security import check_production

    with pytest.raises(RuntimeError):
        check_production(Settings(production=True, admin_password="demo123"))
    with pytest.raises(RuntimeError):  # placeholder phone number
        check_production(Settings(production=True, admin_password="a-long-strong-password"))
    check_production(Settings(
        production=True, admin_password="a-long-strong-password",
        contact_phone="+919847012345", contact_whatsapp="+919847012345",
    ))  # fmt: skip


def admin_form(**overrides):
    return {
        "seller_name": "Mary Thomas", "seller_phone": "9446012345", "property_type": "house",
        "land_area_cents": "8", "location": "Puliyoor", "address": "Thekkethil House", "description": "2BHK",
        "expected_price": "4500000", "negotiable": "true", "documents_available": "false",
        "consent": "true", "consent_version": "test-v1", **overrides,
    }  # fmt: skip


def test_admin_can_add_a_property_for_a_seller(client, admin):
    files = [("photos", ("p.jpg", jpeg_with_gps(), "image/jpeg"))]
    res = client.post("/api/admin/properties", data=admin_form(), files=files, headers=admin)
    assert res.status_code == 201, res.text
    sid, number = res.json()["id"], res.json()["number"]

    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert prop["number"] == number and prop["group"] == "new"
    assert prop["seller"]["seller_phone"] == "+919446012345" and len(prop["photos"]) == 1
    assert publish(client, admin, sid).status_code == 200  # publishes like any other property

    # Not tied to any seller device, so it never shows in someone's "My listings".
    assert all(s["id"] != sid for s in client.get("/api/my/submissions", headers=DEVICE).json())


def test_add_property_needs_admin_and_seller_consent(client, admin):
    assert client.post("/api/admin/properties", data=admin_form()).status_code == 401
    res = client.post("/api/admin/properties", data=admin_form(consent="false"), headers=admin)
    assert res.status_code == 422


def seller_details(**overrides):
    return {
        "seller_name": "Mary T. Thomas", "seller_phone": "9446012300", "property_type": "land",
        "land_area_cents": 10, "location": "Puliyoor", "address": "New address", "description": "Corrected",
        "expected_price": 5000000, "negotiable": False, "documents_available": True,
        "documents_note": "Title deed", "wants_doc_help": True, **overrides,
    }  # fmt: skip


def test_admin_can_correct_seller_details_only_on_properties_they_added(client, admin):
    sid = client.post("/api/admin/properties", data=admin_form(), headers=admin).json()["id"]
    assert client.get(f"/api/admin/properties/{sid}", headers=admin).json()["admin_entered"] is True
    res = client.put(f"/api/admin/properties/{sid}/seller", json=seller_details(), headers=admin)
    assert res.status_code == 200, res.text
    seller = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["seller"]
    assert seller["seller_name"] == "Mary T. Thomas" and seller["seller_phone"] == "+919446012300"
    assert seller["land_area_cents"] == 10 and seller["expected_price"] == 5000000 and seller["wants_doc_help"]

    # A seller's own submission is their record: it can't be changed.
    own = submit(client).json()["id"]
    assert client.get(f"/api/admin/properties/{own}", headers=admin).json()["admin_entered"] is False
    assert client.put(f"/api/admin/properties/{own}/seller", json=seller_details(), headers=admin).status_code == 409
    assert client.put(f"/api/admin/properties/{sid}/seller", json=seller_details()).status_code == 401


def test_admin_can_delete_a_photo(client, admin):
    files = [("photos", ("a.jpg", jpeg_with_gps(), "image/jpeg")), ("photos", ("b.jpg", jpeg_with_gps(), "image/jpeg"))]
    sid = client.post("/api/admin/properties", data=admin_form(), files=files, headers=admin).json()["id"]
    assert publish(client, admin, sid).status_code == 200
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    first, second = (p["id"] for p in prop["photos"])
    listing_id = prop["listing_id"]
    live_before = client.get(f"/api/listings/{listing_id}").json()["photos"]

    assert client.delete(f"/api/admin/photos/{first}").status_code == 401  # admins only
    assert client.delete(f"/api/admin/photos/{first}", headers=admin).status_code == 200
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert [p["id"] for p in prop["photos"]] == [second] and prop["form"]["photo_ids"] == [second]
    assert client.get(f"/api/admin/photos/{first}", headers=admin).status_code == 404
    # Buyers still see the last published version until it's published again.
    assert client.get(f"/api/listings/{listing_id}").json()["photos"] == live_before
    assert publish(client, admin, sid).status_code == 200
    assert len(client.get(f"/api/listings/{listing_id}").json()["photos"]) == 1

    # A new photo can be added again afterwards.
    more = [("photos", ("c.jpg", jpeg_with_gps(), "image/jpeg"))]
    assert client.post(f"/api/admin/properties/{sid}/photos", files=more, headers=admin).status_code == 201


def test_remove_and_restore_a_not_listed_or_sold_property(client, admin):
    def group_ids(group):
        return [p["id"] for p in client.get("/api/admin/properties", params={"group": group}, headers=admin).json()]

    sid = publish_new(client, admin)
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    lid, number = prop["listing_id"], prop["number"]

    # A live property can't be removed: take it down or mark it sold first.
    assert client.post(f"/api/admin/properties/{sid}/remove", headers=admin).status_code == 409
    assert client.post(f"/api/admin/properties/{sid}/sold", headers=admin).status_code == 200
    sold_before = client.get("/api/admin/inbox", headers=admin).json()["counts"]["sold"]
    assert client.get(f"/api/listings/{lid}").status_code == 200  # sold page still public

    assert client.post(f"/api/admin/properties/{sid}/remove").status_code == 401
    assert client.post(f"/api/admin/properties/{sid}/remove", headers=admin).json()["group"] == "removed"
    assert sid not in group_ids("sold")
    assert client.get("/api/admin/inbox", headers=admin).json()["counts"]["sold"] == sold_before - 1
    assert client.get(f"/api/listings/{lid}").status_code == 404  # off the public site
    found = client.get("/api/admin/properties", params={"q": str(number)}, headers=admin).json()
    assert [p["group"] for p in found if p["id"] == sid] == ["removed"]  # still findable by number
    assert client.get(f"/api/admin/properties/{sid}", headers=admin).json()["group"] == "removed"
    assert publish(client, admin, sid).status_code == 409  # restore first

    assert client.post(f"/api/admin/properties/{sid}/restore", headers=admin).json()["group"] == "sold"
    assert sid in group_ids("sold") and client.get(f"/api/listings/{lid}").status_code == 200

    # A taken-down property can be removed too.
    other = publish_new(client, admin)
    assert client.post(f"/api/admin/properties/{other}/take-down", headers=admin).status_code == 200
    assert client.post(f"/api/admin/properties/{other}/remove", headers=admin).status_code == 200
    assert other not in group_ids("not_listed")
