# State machines

Every place where something moves through steps. Change a rule in its **source of truth**, nowhere else.

| What | States | Source of truth | Checked by |
|---|---|---|---|
| Property (admin) | new → live → sold / not listed → removed | `backend/app/admin/lifecycle.py` | `tests/test_lifecycle.py` |
| Public listing | live, sold (hidden when not listed or removed) | follows the property (`lifecycle.STATES`) | `tests/test_lifecycle.py` |
| Buyer request (website) | new (unseen) → seen when the Buyers page opens | `backend/app/buyers/requests.py` (`seen`) | `tests/test_buyer_requests.py` |
| Visit request | new → contacted → scheduled → done; cancelled | `backend/app/core/validation.py` (`VisitStatus`, `OPEN_VISITS`) | `tests/test_journey.py` |
| Meaning search model | off → loading → ready / failed | `backend/app/semantic/engine.py` (`state()`) | `tests/test_semantic.py` |
| Sending any form (Sell, Requirement, visit request, Add property, admin login) | idle → sending → done / error (a second tap while sending is ignored) | `frontend/src/shared/lib/useSubmit.ts` | browser check |
| Sell photos and upload | shrinking photos on the phone; upload % while sending | `frontend/src/features/sell/Sell.tsx` | browser check |
| Where a visitor came from | none → Facebook / Instagram (detected) → an ad or link label (always wins; kept 30 days) | `frontend/src/shared/lib/source.ts` | `tests/test_analytics.py` + browser check |
| Land size unit | cents ⇄ acres (always sent as cents) | `frontend/src/shared/components/form/SizeInput.tsx` | browser check |
| Unfinished Sell form | none → saved draft → restored → discarded on submit | `frontend/src/features/sell/useSellDraft.ts` | browser check |

## Property

```
new ──publish──▶ live ──sold──────▶ sold ──remove──▶ removed
 │                │ ▲                                  │
 │                │ └──publish (again)──┐              │ restore (back to the group it was in)
 │                └──take_down──▶ not_listed ──remove──┘
 └──not_listed──────────────────▶ not_listed
```

- **Stored as** `submissions.status` (+ `removed_at`) and `listings.state`. `lifecycle.GROUPS` maps statuses to
  groups; `lifecycle.STATES` lists the listing state each status may have.
- **Allowed moves** are `lifecycle.ACTIONS`. Every route calls `lifecycle.require(sub, action)` (409 with a
  plain message otherwise). `GET /api/admin/properties/{id}` returns `actions`: the property page shows a button
  only if its action is in that list, so the screen and the server can't disagree.
- `remove` and `restore` only hide/show (the record is kept). Calling them twice is harmless.
- Not used yet: status `under_review` and listing state `draft` (allowed by the database).

**To add a step** (e.g. "reserved"): add it to `GROUPS`/`STATES`/`ACTIONS`, add a route that calls `require`,
add the action to `PropertyAction` in `frontend/src/features/admin/types.ts` and a button behind `can(...)` in
`Property.tsx`, and add a path to `PATHS` in `tests/test_lifecycle.py`.

## Visit request

`new` (buyer asked) → `contacted` → `scheduled` (visit fixed) → `done`, or `cancelled` from any open step.
Founders may step back (a fixed visit that needs a new date goes back to contacted). `OPEN_VISITS` (new,
contacted, scheduled) is what still needs attention: Inbox, open-visit counts, and repeat requests from the same
phone all use it.
