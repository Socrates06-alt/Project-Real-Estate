"""The property lifecycle: the ONE place that says what can happen to a property, and when.

A property is in one group (what founders see). Each action moves it to another group:

    new ──publish──▶ live ──sold──────▶ sold ──remove──▶ removed
     │                │ ▲                                  │
     │                │ └──publish (again)──┐              │ restore (back to the group it was in)
     │                └──take_down──▶ not_listed ──remove──┘
     └──not_listed──────────────────▶ not_listed

- "publish" on a live property saves changes (a new published version); it stays live.
- "remove" and "restore" don't change the status, only hide/show it (removed_at); the record is always kept.

Stored as: submissions.status (+ removed_at) and listings.state. GROUPS maps statuses to groups; STATES says which
listing state each status must have. Routes call `require(sub, action)`; the property page gets `actions_for(sub)`
so the screen only offers what the server allows. tests/test_lifecycle.py walks every path and checks the two
stored values never disagree.
"""

from typing import Literal

from fastapi import HTTPException

Group = Literal["new", "live", "sold", "not_listed", "removed"]
Action = Literal["publish", "sold", "take_down", "not_listed", "remove", "restore"]

# Stored submission status -> group. ('under_review' is allowed by the database but not used yet.)
GROUPS: dict[str, tuple[str, ...]] = {
    "new": ("received", "under_review"),
    "live": ("listed",),
    "sold": ("sold",),
    "not_listed": ("withdrawn", "rejected"),
}

# Which listing state goes with each status (None: no listing yet, or one that is not shown).
# A removed sold property's listing is 'withdrawn' (hidden) until it is restored.
STATES: dict[str, tuple[str | None, ...]] = {
    "received": (None,),
    "under_review": (None,),
    "listed": ("published",),
    "sold": ("sold", "withdrawn"),
    "withdrawn": ("withdrawn",),
    "rejected": (None, "withdrawn"),
}

# action -> (groups it is allowed from, message when it isn't)
ACTIONS: dict[str, tuple[tuple[str, ...], str]] = {
    "publish": (("new", "live", "not_listed"), "This property can't be published now"),
    "sold": (("live",), "Only live properties can be changed this way"),
    "take_down": (("live",), "Only live properties can be changed this way"),
    "not_listed": (("new",), "Only new properties can be marked not listed"),
    "remove": (("not_listed", "sold"), "Take it down or mark it sold first, then remove it"),
    "restore": (("removed",), "This property isn't removed"),
}

# Clearer messages for the commonest wrong moves.
_SPECIFIC = {
    ("publish", "sold"): "This property is already sold",
    ("publish", "removed"): "This property was removed. Restore it first",
}


def status_group(status: str) -> str:
    return next(g for g, statuses in GROUPS.items() if status in statuses)


def group_of(sub: dict) -> str:
    return "removed" if sub.get("removed_at") else status_group(sub["status"])


def actions_for(sub: dict) -> list[str]:
    """What can be done to this property now (the screen shows only these)."""
    group = group_of(sub)
    return [a for a, (allowed, _) in ACTIONS.items() if group in allowed]


def can(sub: dict, action: str) -> bool:
    return group_of(sub) in ACTIONS[action][0]


def require(sub: dict, action: str) -> None:
    """Stop with a clear 409 if the action isn't allowed from the property's current group."""
    if not can(sub, action):
        group = group_of(sub)
        raise HTTPException(409, _SPECIFIC.get((action, group), ACTIONS[action][1]))
