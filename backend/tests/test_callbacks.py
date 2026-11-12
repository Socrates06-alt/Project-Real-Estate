"""'Call me back': name and number only; founders see who is waiting and mark them done."""

from app.callbacks.routes import callback_limiter


def test_call_me_back(client, admin):
    callback_limiter.reset()
    body = {"name": "Kumar", "phone": "+971 50 111 2222", "want": "sell", "came_from": "fb-ad"}
    assert client.post("/api/callbacks", json=body).status_code == 201
    assert client.post("/api/callbacks", json={**body, "want": "buy"}).status_code == 201  # asks again: one entry
    waiting = client.get("/api/admin/callbacks", headers=admin).json()
    mine = [c for c in waiting if c["phone"] == "+971501112222"]
    assert len(mine) == 1 and mine[0]["want"] == "buy" and mine[0]["came_from"] == "fb-ad"
    assert client.get("/api/admin/inbox", headers=admin).json()["callbacks"] >= 1
    assert client.post(f"/api/admin/callbacks/{mine[0]['id']}/done", headers=admin).json()["done"] is True
    assert all(c["phone"] != "+971501112222" for c in client.get("/api/admin/callbacks", headers=admin).json())


def test_call_me_back_checks_and_limits(client):
    callback_limiter.reset()
    assert client.post("/api/callbacks", json={"name": "A", "phone": "9847011111"}).status_code == 422
    assert client.post("/api/callbacks", json={"name": "Anu", "phone": "123"}).status_code == 422
    assert client.get("/api/admin/callbacks").status_code == 401
    for i in range(10):
        client.post("/api/callbacks", json={"name": "Anu", "phone": f"98470{i:05d}"})
    assert client.post("/api/callbacks", json={"name": "Anu", "phone": "9847099999"}).status_code == 429
    callback_limiter.reset()
