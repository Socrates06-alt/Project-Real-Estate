"""The property state machine (app/admin/lifecycle.py): every allowed path keeps the stored values consistent,
every disallowed action is refused, and the property page offers exactly the allowed actions."""

import pytest

from app.admin import lifecycle
from app.core.db import connect
from tests.helpers import publish, submit

DO = {  # action -> how a founder does it
    "publish": lambda c, h, sid: publish(c, h, sid),
    "sold": lambda c, h, sid: c.post(f"/api/admin/properties/{sid}/sold", headers=h),
    "take_down": lambda c, h, sid: c.post(f"/api/admin/properties/{sid}/take-down", headers=h),
    "not_listed": lambda c, h, sid: c.post(f"/api/admin/properties/{sid}/not-listed", json={"note": ""}, headers=h),
    "remove": lambda c, h, sid: c.post(f"/api/admin/properties/{sid}/remove", headers=h),
    "restore": lambda c, h, sid: c.post(f"/api/admin/properties/{sid}/restore", headers=h),
}

PATHS = [
    ["publish", "publish", "sold", "remove", "restore"],
    ["publish", "take_down", "publish", "take_down", "remove", "restore", "publish"],
    ["not_listed", "publish", "sold"],
    ["not_listed", "remove", "restore"],
]


def stored(sid: str) -> tuple[str, str | None]:
    db = connect()
    try:
        row = db.execute(
            "select s.status, l.state from submissions s left join listings l on l.submission_id = s.id where s.id = ?",
            (sid,),
        ).fetchone()
        return row[0], row[1]
    finally:
        db.close()


def check_consistent(client, admin, sid):
    status, state = stored(sid)
    assert state in lifecycle.STATES[status], (status, state)
    page = client.get(f"/api/admin/properties/{sid}", headers=admin).json()
    for action in lifecycle.ACTIONS:  # the page offers an action exactly when the server accepts it
        assert (action in page["actions"]) == (page["group"] in lifecycle.ACTIONS[action][0])
    return page


@pytest.mark.parametrize("path", PATHS)
def test_every_path_stays_consistent_and_refuses_wrong_moves(client, admin, path):
    sid = submit(client).json()["id"]
    page = check_consistent(client, admin, sid)
    for step in path:
        # (restore when not removed, and remove when already removed, are harmless no-ops)
        idempotent = {"restore"} | ({"remove"} if page["group"] == "removed" else set())
        for wrong in set(lifecycle.ACTIONS) - set(page["actions"]) - idempotent:
            assert DO[wrong](client, admin, sid).status_code == 409, (page["group"], wrong)
        assert step in page["actions"], (page["group"], step)
        assert DO[step](client, admin, sid).status_code == 200, (page["group"], step)
        page = check_consistent(client, admin, sid)


def test_public_site_follows_the_lifecycle(client, admin):
    sid = submit(client).json()["id"]
    lid = publish(client, admin, sid).json()["listing_id"]
    assert client.get(f"/api/listings/{lid}").json()["status"] == "live"
    DO["sold"](client, admin, sid)
    assert client.get(f"/api/listings/{lid}").json()["status"] == "sold"
    DO["remove"](client, admin, sid)
    assert client.get(f"/api/listings/{lid}").status_code == 404
    DO["restore"](client, admin, sid)
    assert client.get(f"/api/listings/{lid}").json()["status"] == "sold"
