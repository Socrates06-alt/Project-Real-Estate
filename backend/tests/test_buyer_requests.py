"""Buyers ask for a property they didn't find; it lands in the founders' Buyers list."""

from app.buyers.requests import request_limiter


def ask(client, **over):
    body = {"name": "Anil Kumar", "phones": ["+971 50 123 4567"], "property_type": "land", **over}
    return client.post("/api/buyer-requests", json=body)


def test_request_lands_in_buyers_list_as_new(client, admin):
    request_limiter.reset()
    res = ask(client, area="Puliyoor", min_cents=10, max_cents=5, sqft=1200, budget_lakh=40, note="near a school")
    assert res.status_code == 201
    buyers = client.get("/api/admin/buyers", params={"q": "Anil Kumar"}, headers=admin).json()
    b = buyers[0]
    assert b["source"] == "website" and b["seen"] is False and b["phones"] == ["+971501234567"]
    assert b["wants_finance_help"] is False
    assert b["notes"] == "5-10 cents · about 1200 sq ft · budget up to 40 lakh · near a school"
    assert client.get("/api/admin/inbox", headers=admin).json()["buyer_requests"] >= 1
    client.post("/api/admin/buyers/seen", headers=admin)
    assert client.get("/api/admin/inbox", headers=admin).json()["buyer_requests"] == 0


def test_size_and_budget_are_optional_and_repeats_update(client, admin):
    request_limiter.reset()
    assert ask(client, name="Beena", phones=["9847099999"], wants_finance_help=True).status_code == 201
    assert ask(client, name="Beena P", phones=["9847099999"], property_type="house", budget_lakh=60).status_code == 201
    found = client.get("/api/admin/buyers", params={"q": "9847099999"}, headers=admin).json()
    assert len(found) == 1 and found[0]["name"] == "Beena P" and found[0]["notes"] == "budget up to 60 lakh"


def test_request_needs_name_phone_and_type_and_is_rate_limited(client):
    request_limiter.reset()
    assert ask(client, phones=[]).status_code == 422
    assert ask(client, property_type="any").status_code == 422
    assert ask(client, name="A").status_code == 422
    for i in range(10):
        ask(client, phones=[f"98470{i:05d}"])
    assert ask(client, phones=["9847055555"]).status_code == 429
    request_limiter.reset()


def test_large_sizes_are_written_in_acres(client, admin):
    request_limiter.reset()
    ask(client, name="Acre Buyer", phones=["9847088888"], min_cents=100, max_cents=250)
    found = client.get("/api/admin/buyers", params={"q": "9847088888"}, headers=admin).json()
    assert found[0]["notes"] == "1-2.5 acres"
