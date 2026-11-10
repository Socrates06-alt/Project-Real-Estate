"""Temporary one-time English clean-up tool (Sarvam AI, faked here: no network)."""

import json

import pytest

from app.core.config import get_settings
from tests.helpers import publish, submit


class FakeReply:
    def __init__(self, content: str, status: int = 200):
        self.status_code, self._content, self.text = status, content, content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


@pytest.fixture
def sarvam(monkeypatch):
    monkeypatch.setattr(get_settings(), "sarvam_api_key", "sk_test")
    sent = []

    def fake_post(url, json=None, headers=None, timeout=None):
        sent.append({"url": url, "json": json, "headers": headers})
        return fake_post.reply

    fake_post.reply = None
    monkeypatch.setattr("app.cleanup.sarvam.httpx.post", fake_post)
    fake_post.sent = sent
    return fake_post


def live_listing(client, admin, description):
    sid = submit(client, description=description, location="പുലിയൂർ").json()["id"]
    assert publish(client, admin, sid, description=description).status_code == 200
    return sid


def test_clean_up_previews_then_applies_english_text(client, admin, sarvam):
    sid = live_listing(client, admin, "റോഡ് സൈഡ് 10 സെന്റ് സ്ഥലം, കിണർ ഉണ്ട്")
    before = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    cleaned = {
        "title": "Land for sale",
        "location": "Puliyoor",
        "description": "10 cents of roadside land with a well.",
        "documents_note": "Title deed available.",
    }
    # Replies may wrap the JSON in reasoning or code fences.
    sarvam.reply = FakeReply("<think>translating</think>\n```json\n" + json.dumps(cleaned) + "\n```")

    assert client.get("/api/admin/cleanup", headers=admin).json()["enabled"] is True
    prev = client.post(f"/api/admin/cleanup/{sid}/preview", headers=admin).json()
    assert prev["after"]["description"] == cleaned["description"] and prev["after"]["location"] == "Puliyoor"
    assert "റോഡ്" in prev["before"]["description"]
    # Only the public listing text is sent, never seller details.
    sent = sarvam.sent[-1]
    assert sent["headers"]["api-subscription-key"] == "sk_test" and sent["json"]["model"]
    assert "Ravi" not in json.dumps(sent["json"]) and "98470" not in json.dumps(sent["json"])

    res = client.post(f"/api/admin/cleanup/{sid}/apply", json=prev["after"], headers=admin)
    assert res.status_code == 200, res.text
    after = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    assert after["form"]["description"] == cleaned["description"] and after["form"]["location"] == "Puliyoor"
    # Price, size and photos unchanged; buyers see the new version.
    assert after["form"]["price"] == before["form"]["price"]
    assert after["form"]["land_area_cents"] == before["form"]["land_area_cents"]
    assert after["form"]["photo_ids"] == before["form"]["photo_ids"]
    public = client.get(f"/api/listings/{after['listing_id']}").json()
    assert public["description"] == cleaned["description"]


def test_bad_or_empty_fields_keep_the_original(client, admin, sarvam):
    sid = live_listing(client, admin, "Nalla sthalam")
    sarvam.reply = FakeReply(
        json.dumps({"title": "", "location": "x" * 300, "description": "A good plot.", "documents_note": ""})
    )
    prev = client.post(f"/api/admin/cleanup/{sid}/preview", headers=admin).json()
    assert prev["after"]["title"] == prev["before"]["title"]  # empty title: kept
    assert prev["after"]["location"] == prev["before"]["location"]  # too long: kept
    assert prev["after"]["description"] == "A good plot."


def test_sarvam_errors_and_access(client, admin, sarvam):
    sid = live_listing(client, admin, "Plot")
    sarvam.reply = FakeReply("quota exceeded", status=429)
    res = client.post(f"/api/admin/cleanup/{sid}/preview", headers=admin)
    assert res.status_code == 502 and "429" in res.json()["detail"]
    sarvam.reply = FakeReply("sorry, no JSON here")
    assert client.post(f"/api/admin/cleanup/{sid}/preview", headers=admin).status_code == 502
    assert client.post(f"/api/admin/cleanup/{sid}/preview").status_code == 401
    new = submit(client).json()["id"]  # not live
    assert client.post(f"/api/admin/cleanup/{new}/preview", headers=admin).status_code == 404


def test_tool_is_off_without_a_key(client, admin):
    assert client.get("/api/admin/cleanup", headers=admin).json()["enabled"] is False
