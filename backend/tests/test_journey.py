"""The whole journey: seller submits, admin publishes, buyer finds it and asks for a visit."""

from tests.helpers import DEVICE, publish, submit


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
    small = data["photos"][0].replace(".webp", "-sm.webp")  # light copy for cards
    assert client.get(small).status_code == 200
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
