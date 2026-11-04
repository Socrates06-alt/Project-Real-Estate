# LandFinder backend

A lean FastAPI app on **SQLite**: no database server, no cloud accounts. The database file
(`nilayam.db`) and photo folder (`media/`) are created automatically on first start.

Organised by feature. Each feature folder has its own `routes.py` (HTTP only), and where needed
`schemas.py` (request validation) and `service.py` (business rules). Shared code lives in `core/`.

```
app/
  main.py               app setup: routers, CORS, startup, published photos
  core/                 shared by every feature
    config.py           settings from .env, LandFinder's public contact
    db.py               SQLite connection per request + row helpers
    migrations.py       schema, immutability triggers, in-place upgrades
    security.py         admin tokens, login attempt limit, live-server checks
    ratelimit.py        small in-memory rate limiter
    validation.py       shared field types (Indian phone, price, cents...)
  site/routes.py        /api/health, /api/config
  listings/             buyers: browse, search, one listing
    routes.py  search.py ("house under 40 lakh Mulakuzha" -> filters)  geo.py (distance, area flag)
  submissions/          sellers: submit a property, My listings
    routes.py  schemas.py  photos.py (strip GPS, resize, private originals, public copies)
  visits/               visit requests (buyers) and their updates (admin)
    routes.py  schemas.py
  admin/                founders only
    routes_auth.py      login
    routes_properties.py inbox, properties, editor actions
    service.py          publish rules, groups, sold / take down
    schemas.py
seed_demo.py            sample listings
tests/                  one file per feature; shared setup in conftest.py, helpers.py
```

## Run

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # set ADMIN_PASSWORD   (macOS/Linux: cp)
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

Sample data (API running): `python seed_demo.py` · Tests: `pytest -q`

## Built in

Seller identity never public, photo GPS stripping, immutable original submissions and published
versions, versioned publishing, seller confirmation for big price changes, admin login limit,
area-search rate limit, production setting checks.

Later (see `docs/V1_PLAN.md`): PostgreSQL, cloud photo storage, audit log.
