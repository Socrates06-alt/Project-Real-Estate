"""Buyers: area (map) search, badges and filters."""

from tests.helpers import publish, submit

PULIYOOR = (9.3040, 76.5830)


ALA = (9.3300, 76.5950)  # ~3 km from Puliyoor


VENMONY = (9.2560, 76.6460)  # ~8.5 km from Puliyoor


def publish_in_area(client, admin, area, name):
    sid = submit(client, location=name, area_lat=str(area[0]), area_lng=str(area[1])).json()["id"]
    res = publish(client, admin, sid).json()  # form defaults to the seller's chosen area
    return sid, res["listing_id"]


def test_area_search_finds_by_area_and_never_reveals_location(client, admin):
    from app.listings.routes import area_search_limiter

    area_search_limiter.reset()
    sid, p1 = publish_in_area(client, admin, PULIYOOR, "Puliyoor")
    _, p2 = publish_in_area(client, admin, PULIYOOR, "Puliyoor")
    _, a1 = publish_in_area(client, admin, ALA, "Ala")
    _, v1 = publish_in_area(client, admin, VENMONY, "Venmony")

    # Private address only in admin.
    prop = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert prop["seller"]["address"].startswith("Kizhakkethil")

    def search(km):
        return client.get("/api/listings", params={"lat": PULIYOOR[0], "lng": PULIYOOR[1], "radius_km": km}).json()

    r5 = search(5)
    ids5 = [i["id"] for i in r5["items"]]
    assert {p1, p2, a1} <= set(ids5) and v1 not in ids5
    # Nearest area first (both Puliyoor ones before Ala), newest first within Puliyoor.
    assert ids5.index(p2) < ids5.index(p1) < ids5.index(a1)
    assert v1 in [i["id"] for i in search(10)["items"]]

    # No coordinates, distances or address in anything buyers can load.
    for item in [*r5["items"], client.get(f"/api/listings/{p1}").json()]:
        assert not {"lat", "lng", "public_lat", "public_lng", "distance_km", "address"} & item.keys()
    assert "Kizhakkethil" not in client.get(f"/api/listings/{p1}").text


def test_area_search_is_rate_limited(client):
    from app.listings.routes import area_search_limiter

    area_search_limiter.reset()
    area_search_limiter.limit = 3
    try:
        params = {"lat": PULIYOOR[0], "lng": PULIYOOR[1], "radius_km": 5}
        codes = [client.get("/api/listings", params=params).status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]
        assert client.get("/api/listings").status_code == 200  # normal browsing is not limited
    finally:
        area_search_limiter.limit = 300
        area_search_limiter.reset()


def test_grid_flag_is_shared_within_an_area():
    from app.listings.geo import flag

    assert flag(9.30401, 76.58302) == flag(9.30455, 76.58377)  # two spots in the same ~1 km square


def test_home_badges_and_documents_filter(client, admin):
    sid = submit(client, location="Ennakkad", documents_available="true").json()["id"]
    lid = publish(client, admin, sid).json()["listing_id"]
    item = client.get(f"/api/listings/{lid}").json()
    assert item["listed_at"] and item["price_reduced"] is False

    publish(client, admin, sid, price=2_900_000)  # small drop, no confirmation needed
    assert client.get(f"/api/listings/{lid}").json()["price_reduced"] is True

    nodocs = submit(client, location="Ennakkad", documents_available="false").json()["id"]
    nodocs_lid = publish(client, admin, nodocs).json()["listing_id"]
    with_docs = [i["id"] for i in client.get("/api/listings", params={"docs": True, "limit": 50}).json()["items"]]
    assert lid in with_docs and nodocs_lid not in with_docs
