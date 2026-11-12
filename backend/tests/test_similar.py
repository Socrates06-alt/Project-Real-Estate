"""Below a property: similar ones (same type, affordable, nearest first, any place) and places with counts."""

from tests.helpers import publish, submit


def live(client, admin, **sub) -> str:
    sid = submit(client, **sub).json()["id"]
    res = publish(client, admin, sid, seller_confirmed=True)
    assert res.status_code == 200, res.text
    return res.json()["listing_id"]


def test_similar_properties_and_places(client, admin):
    me = live(client, admin, property_type="land", expected_price=2_000_000, location="Puliyoor")
    cheap_alike = live(client, admin, property_type="land", expected_price=2_200_000, location="Mulakuzha")
    too_dear = live(client, admin, property_type="land", expected_price=9_000_000, location="Pandanad")
    house = live(client, admin, property_type="house", expected_price=2_000_000, location="Puliyoor")

    res = client.get(f"/api/listings/{me}/similar").json()
    ids = [s["id"] for s in res["similar"]]
    assert me not in ids and house not in ids  # never itself, only the same type
    assert cheap_alike in ids  # same type and in budget
    if too_dear in ids:  # out of budget only fills up, after the ones in budget
        assert ids.index(cheap_alike) < ids.index(too_dear)
    assert len(ids) <= 6
    assert all(s["property_type"] == "land" for s in res["similar"])
    places = {p["place"]: p["count"] for p in res["places"]}
    assert places["Puliyoor"] >= 2 and places["Mulakuzha"] >= 1
    assert "seller_name" not in str(res) and "seller_phone" not in str(res)  # public data only
    assert client.get("/api/listings/00000000-0000-0000-0000-000000000000/similar").status_code == 404
