# LandFinder backend

A lean FastAPI app on **SQLite**: no database server, no cloud accounts. The database file
(`nilayam.db`) and photo folder (`media/`) are created automatically on first start.

Organised by feature. Each feature folder has its own `routes.py` (HTTP only), and where needed
`schemas.py` (request validation) and `service.py` (business rules). Shared code lives in `core/`.

```
app/
  main.py         app setup, routers, startup (search model loads in background)
  core/           config, db, migrations (schema + upgrades), security, ratelimit, validation
  site/           /api/health, /api/config
  listings/       public browse/search (search.py: "house under 40 lakh" -> filters), geo
  submissions/    Sell form, My listings, photos (GPS stripped, resized)
  visits/         visit requests
  callbacks/      "call me back"
  buyers/         buyer list, website requests, CSV import, property matching
  analytics/      visitor counter and sources
  semantic/       search by meaning (fastembed model, vectors in SQLite)
  cleanup/        one-time English tidy-up (Sarvam)
  admin/          login, inbox, property editor; lifecycle.py = allowed property moves
seed_demo.py  renumber.py  semantic_check.py   one-off scripts
tests/          one file per feature
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
