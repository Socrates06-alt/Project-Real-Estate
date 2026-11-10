"""Matching on every relevant detail (type, area incl. address area, size, budget), and admin cross-search."""

from app.semantic.needs import read_needs
from tests.helpers import admin_form_data, publish


def test_reading_size_and_budget_from_a_buyer_description():
    n = read_needs("10-20 cents near the main road, budget 25 L")
    assert (n.min_cents, n.max_cents, n.max_price) == (10, 20, 2_500_000)
    n = read_needs("around 1 acre, 1.5 crore")
    assert n.min_cents == 75 and n.max_cents == 125 and n.max_price == 15_000_000
    n = read_needs("5 to 8 cents, 2 lakh per cent")
    assert (n.min_cents, n.max_cents, n.max_per_cent, n.max_price) == (5, 8, 200_000, None)
    assert read_needs("3 bedroom house, 60-70 lakh").max_price == 7_000_000
    assert read_needs("house with a well") == read_needs("")


def listed(client, admin, place, cents, price, address="", negotiable="false"):
    data = admin_form_data(
        property_type="land", location=place, land_area_cents=str(cents), expected_price=str(price),
        address=address, negotiable=negotiable, description="Plot",
    )  # fmt: skip
    sid = client.post("/api/admin/properties", data=data, headers=admin).json()["id"]
    assert publish(client, admin, sid).status_code == 200
    return sid


def buyer(client, admin, name, area, notes, phone="9847055500"):
    body = {"name": name, "phones": [phone], "area": area, "property_type": "land", "notes": notes}
    return client.post("/api/admin/buyers", json=body, headers=admin).json()["id"]


def test_size_and_budget_decide_the_match(client, admin):
    fits = listed(client, admin, "Venmony", 12, 2_000_000)
    too_big = listed(client, admin, "Venmony", 60, 2_000_000)
    too_dear = listed(client, admin, "Venmony", 15, 5_000_000)
    bid = buyer(client, admin, "Sreeja", "Venmony", "10-20 cents near the road, budget 25 L")

    found = {p["property_id"]: p for p in client.get(f"/api/admin/buyers/{bid}/matches", headers=admin).json()}
    assert fits in found and too_big not in found and too_dear not in found
    assert "Size fits: 12 cents" in found[fits]["reasons"]
    assert any(r.startswith("Within budget") for r in found[fits]["reasons"])
    names = [m["name"] for m in client.get(f"/api/admin/properties/{fits}/matches", headers=admin).json()]
    assert "Sreeja" in names


def test_budget_per_cent_and_address_area(client, admin):
    cheap = listed(client, admin, "Chengannur", 10, 1_800_000, address="Vadakkethil, Ennakkad P.O.")  # 1.8 L/cent
    dear = listed(client, admin, "Chengannur", 10, 3_000_000, address="Ennakkad")  # 3 L/cent
    bid = buyer(client, admin, "Joby", "Ennakkad", "around 10 cents, 2 lakh per cent")
    found = {p["property_id"]: p for p in client.get(f"/api/admin/buyers/{bid}/matches", headers=admin).json()}
    assert cheap in found and dear not in found  # place found from the (private) address area
    assert any("/cent" in r for r in found[cheap]["reasons"])


def test_cross_search_by_buyer_and_seller(client, admin):
    sid = listed(client, admin, "Kozhuvalloor", 8, 1_600_000)
    number = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["number"]
    buyer(client, admin, "Ramachandran", "Kozhuvalloor", "5-10 cents", phone="9847066600")

    # Properties: search a buyer's name or phone -> the listed properties that match them.
    for q in ("Ramachandran", "98470 66600"):
        hits = {p["id"]: p for p in client.get("/api/admin/properties", params={"q": q}, headers=admin).json()}
        assert sid in hits and hits[sid]["via"] == "Matches buyer: Ramachandran"

    # Visit requests: the requester's name finds the property they asked about.
    lid = client.get(f"/api/admin/properties/{sid}", headers=admin).json()["listing_id"]
    client.post(f"/api/listings/{lid}/visit-requests", json={"name": "Thankamma", "phone": "9447012121"})
    hits = {p["id"]: p for p in client.get("/api/admin/properties", params={"q": "Thankamma"}, headers=admin).json()}
    assert hits[sid]["via"] == "Visit request: Thankamma"

    # Buyers: search a property number or the seller's name -> the buyers who match it.
    for q in (str(number), "Mary Thomas"):
        hits = {b["name"]: b for b in client.get("/api/admin/buyers", params={"q": q}, headers=admin).json()}
        assert "Ramachandran" in hits and hits["Ramachandran"]["via"].startswith(f"Matches #{number}")
