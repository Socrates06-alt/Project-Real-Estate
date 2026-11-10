"""Importing buyers from a spreadsheet."""

CSV = """No,Name,Phone,Other phone,Area,Type,Needs (notes)
3,? (wife Niya),+966554268358,8921096822,Ala,Land,15 cents?
4,Sruthi Nair,,,Puliyoor?,Land,Land for a house?
23,?,+974 12?,,Othera,Commercial,10 cents
"""


def test_import_buyers(client, admin):
    res = client.post("/api/admin/buyers/import", json={"csv": CSV}, headers=admin).json()
    assert res["added"] == 3
    buyers = {b["name"]: b for b in client.get("/api/admin/buyers", headers=admin).json()}
    assert buyers["? (wife Niya)"]["phones"] == ["+966554268358", "+918921096822"]
    assert (
        buyers["Sruthi Nair"]["notes"].startswith("Paper #4 · ") and "Phone missing" in buyers["Sruthi Nair"]["notes"]
    )
    assert buyers["Sruthi Nair"]["property_type"] == "land"
    odd = buyers["Unknown (#23) ?"]
    assert odd["property_type"] == "land" and odd["phones"] == []  # too short to be valid
    assert "Phone to check: +974 12?" in odd["notes"]
    again = client.post("/api/admin/buyers/import", json={"csv": CSV}, headers=admin).json()
    assert again == {"added": 0, "skipped": 3, "problems": []}


def test_import_with_chosen_type(client, admin):
    csv = "Name,Phone\nAnu Mathew,9847011111\nBiju K,9847022222\n"
    client.post("/api/admin/buyers/import", json={"csv": csv, "property_type": "house"}, headers=admin)
    found = client.get("/api/admin/buyers", params={"q": "Anu Mathew"}, headers=admin).json()
    assert found[0]["property_type"] == "house"
    client.post("/api/admin/buyers/import", json={"csv": "Name\nCiya Other\n", "property_type": None}, headers=admin)
    assert client.get("/api/admin/buyers", params={"q": "Ciya"}, headers=admin).json()[0]["property_type"] is None


def test_same_person_on_land_and_house_lists(client, admin):
    csv = "Name,Phone\nKala,9656808162\n"
    assert client.post("/api/admin/buyers/import", json={"csv": csv}, headers=admin).json()["added"] == 1
    house = client.post("/api/admin/buyers/import", json={"csv": csv, "property_type": "house"}, headers=admin).json()
    assert house["added"] == 1
    found = client.get("/api/admin/buyers", params={"q": "Kala"}, headers=admin).json()
    kinds = sorted(b["property_type"] for b in found)
    assert kinds == ["house", "land"]


def test_replace_matches_the_paper_list(client, admin):
    client.post("/api/admin/buyers", json={"name": "Old Land", "phones": [], "property_type": "land"}, headers=admin)
    csv = "No,Name,Phone\n1,Sai wife,\n2,Sai wife,\n"  # the paper repeats a person: both rows stay
    res = client.post("/api/admin/buyers/import", json={"csv": csv, "replace": True}, headers=admin).json()
    assert res["added"] == 2
    names = [b["name"] for b in client.get("/api/admin/buyers", headers=admin).json() if b["property_type"] == "land"]
    assert sorted(names) == ["Sai wife", "Sai wife"]


def test_remove_all_buyers(client, admin):
    client.post("/api/admin/buyers/import", json={"csv": "Name\nAnu\nBiju\n"}, headers=admin)
    assert client.delete("/api/admin/buyers", headers=admin).status_code == 400  # must type DELETE
    assert client.delete("/api/admin/buyers", params={"confirm": "DELETE"}, headers=admin).json()["deleted"] >= 2
    assert client.get("/api/admin/buyers", headers=admin).json() == []
