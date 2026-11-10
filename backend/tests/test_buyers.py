"""Buyers list: founders only; several phones; search; edit and delete."""


def buyer(**overrides):
    return {
        "name": "Suresh Kumar", "phones": ["98470 11111", "+91 94460 22222"], "area": "Puliyoor",
        "property_type": "land", "notes": "Wants 10-15 cents near the main road, budget 30 L", **overrides,
    }  # fmt: skip


def test_buyers_list_add_search_edit_delete(client, admin):
    assert client.get("/api/admin/buyers").status_code == 401
    res = client.post("/api/admin/buyers", json=buyer(), headers=admin)
    assert res.status_code == 201, res.text
    b = res.json()
    assert b["phones"] == ["+919847011111", "+919446022222"]

    found = lambda q: [x["id"] for x in client.get("/api/admin/buyers", params={"q": q}, headers=admin).json()]  # noqa: E731
    assert b["id"] in found("suresh") and b["id"] in found("puliyoor") and b["id"] in found("main road")
    assert b["id"] in found("94460 22222") and b["id"] in found("+91 98470 11111")

    edited = client.put(
        f"/api/admin/buyers/{b['id']}",
        json=buyer(name="Suresh K", phones=["9847011111"], property_type=None),
        headers=admin,
    ).json()
    assert edited["name"] == "Suresh K" and edited["phones"] == ["+919847011111"] and edited["property_type"] is None

    assert client.delete(f"/api/admin/buyers/{b['id']}", headers=admin).status_code == 200
    assert b["id"] not in found("")
    assert client.delete(f"/api/admin/buyers/{b['id']}", headers=admin).status_code == 404


def test_buyer_needs_a_valid_phone(client, admin):
    assert client.post("/api/admin/buyers", json=buyer(phones=[]), headers=admin).status_code == 422
    assert client.post("/api/admin/buyers", json=buyer(phones=["12345"]), headers=admin).status_code == 422


def test_buyer_financial_assistance_flag_and_search(client, admin):
    b = client.post("/api/admin/buyers", json=buyer(name="Anil", wants_finance_help=True), headers=admin).json()
    assert b["wants_finance_help"] is True
    ids = [x["id"] for x in client.get("/api/admin/buyers", params={"q": "finance"}, headers=admin).json()]
    assert b["id"] in ids
    changes = buyer(name="Anil", wants_finance_help=False)
    assert client.put(f"/api/admin/buyers/{b['id']}", json=changes, headers=admin).json()["wants_finance_help"] is False
