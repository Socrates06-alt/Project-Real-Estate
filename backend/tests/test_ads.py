"""Advertise plans: the seller pays upfront, the ad is public only while paid, and buyers call the owner."""

import sqlite3

from app.core.config import get_settings
from tests.helpers import DEVICE, publish, submit


def public_ids(client) -> list[str]:
    return [i["id"] for i in client.get("/api/listings", params={"limit": 50}).json()["items"]]


def test_ad_listing_is_public_only_while_paid(client, admin):
    sub = submit(client, plan="ad_social", seller_phone="9847012121").json()
    lid = publish(client, admin, sub["id"], seller_confirmed=True).json()["listing_id"]
    assert lid not in public_ids(client)  # published but not paid yet
    assert client.get(f"/api/listings/{lid}").status_code == 404

    # Seller says they paid; it shows up for founders to confirm
    assert client.post(f"/api/my/submissions/{sub['id']}/payment-claim", headers=DEVICE).status_code == 200
    inbox = client.get("/api/admin/inbox", headers=admin).json()
    assert sub["id"] in [r["id"] for r in inbox["ads_to_confirm"]]

    paid = client.post(f"/api/admin/properties/{sub['id']}/paid", headers=admin).json()
    assert paid["ad_expires_at"] > paid["paid_at"]
    assert sub["id"] not in [r["id"] for r in client.get("/api/admin/inbox", headers=admin).json()["ads_to_confirm"]]

    listing = client.get(f"/api/listings/{lid}").json()
    assert listing["listed_by"] == "owner" and listing["featured"] is True
    assert listing["owner_contact"]["phone"] == "+919847012121"  # buyers call the owner directly
    assert public_ids(client)[0] == lid  # featured first

    # Expired: hidden again until renewed; renewing extends from today
    with sqlite3.connect(get_settings().database_path) as db:
        db.execute("update submissions set ad_expires_at = '2000-01-01T00:00:00Z' where id = ?", (sub["id"],))
    assert lid not in public_ids(client)
    renewed = client.post(f"/api/admin/properties/{sub['id']}/paid", headers=admin).json()
    assert renewed["ad_expires_at"] > "2026"
    assert lid in public_ids(client)


def test_commission_listing_unchanged_and_hides_owner(client, admin):
    sub = submit(client).json()
    lid = publish(client, admin, sub["id"], seller_confirmed=True).json()["listing_id"]
    listing = client.get(f"/api/listings/{lid}").json()
    assert listing["listed_by"] == "landfinder" and listing["featured"] is False
    assert listing["owner_contact"] is None
    assert client.post(f"/api/admin/properties/{sub['id']}/paid", headers=admin).status_code == 409


def test_plan_and_posted_can_be_changed_by_founders(client, admin):
    sub = submit(client).json()
    assert (
        client.put(f"/api/admin/properties/{sub['id']}/plan", json={"plan": "ad_web"}, headers=admin).status_code == 200
    )
    assert client.put(f"/api/admin/properties/{sub['id']}/posted", json={"posted": True}, headers=admin).json()[
        "posted"
    ]
    mine = client.get("/api/my/submissions", headers=DEVICE).json()
    assert next(m for m in mine if m["id"] == sub["id"])["plan"] == "ad_web"
