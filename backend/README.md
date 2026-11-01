# Nilayam backend (prototype)

A lean FastAPI app on **SQLite**: no database server, no cloud accounts. The database file
(`nilayam.db`) and photo folder (`media/`) are created automatically on first start.

```
app/
  main.py     app setup, CORS, serves published photos
  config.py   settings from .env
  db.py       SQLite schema + immutability triggers + helpers
  models.py   request validation (phone, price, …)
  public.py   browse, property, visit requests, seller submission, My listings
  admin.py    password login, review queue, drafts, publish, sold/withdraw, visits
  photos.py   strip metadata (incl. GPS), resize, save; private originals, public copies
  search.py   "house under 40 lakh Mulakuzha" → filters
seed_demo.py  sample listings
tests/        key flows (pytest)
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

## What the prototype keeps vs. drops

Kept: seller identity never public, photo GPS stripping, immutable original submissions and
published versions, versioned publishing, seller confirmation for big price changes.

Dropped for now (planned for V1, see `docs/V1_PLAN.md`): PostgreSQL/Supabase, Supabase admin
login, cloud photo storage, rate limiting, captcha, audit log, Docker, CI.
