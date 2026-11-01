# Nilayam backend

FastAPI modular monolith. Postgres (Supabase) via psycopg, photos in Supabase Storage,
admin auth via Supabase JWT + `admins` allowlist. See [`docs/V1_PLAN.md`](../docs/V1_PLAN.md).

```
app/
  main.py            app factory, middleware (request id, JSON logs, body limit, CORS)
  config.py          settings from env / .env
  db.py              connection pool + SQL migration runner
  security.py        device token, client IP, admin JWT verification
  ratelimit.py       in-process per-IP limiter
  images.py          photo sanitising (EXIF/GPS strip, resize, WebP)
  storage.py         local (dev) / Supabase storage
  search.py          rule-based query parser
  cleanup.py         nightly job: purge rejected submissions' photos
  routers/
    public.py        config, listings feed/detail, visit requests
    submissions.py   seller submission, My Listings
    admin.py         review, drafts, publish, price confirmation, sold, visits
migrations/          plain SQL (schema, RLS, immutability triggers)
tests/               pytest against a real Postgres
```

## Run locally

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env              # set DATABASE_URL
python -m app.db                  # apply migrations
uvicorn app.main:app --reload     # http://localhost:8000/docs
```

Add an admin (after creating the user in Supabase Auth, no public sign-up):

```sql
insert into admins (user_id, email) values ('<auth.users id>', 'founder@example.com');
```

## Tests

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nilayam_test pytest -q
```

The test database schema is dropped and recreated on every run.

## API summary

| Method | Path | Who |
|---|---|---|
| GET | `/api/config` | public |
| GET | `/api/listings?q=&type=&status=live\|sold\|all` | public |
| GET | `/api/listings/{id}` | public |
| POST | `/api/listings/{id}/visit-requests` | public |
| POST | `/api/submissions` (multipart, `X-Device-Token`) | seller |
| GET | `/api/my/submissions` (`X-Device-Token`) | seller |
| GET | `/api/admin/submissions[/{id}]`, `/api/admin/photos/{id}` | admin |
| POST | `/api/admin/submissions/{id}/draft` · `/reject` | admin |
| GET/PATCH | `/api/admin/listings[/{id}]` | admin |
| POST | `/api/admin/listings/{id}/price-confirmation` · `/publish` · `/sold` · `/withdraw` | admin |
| GET/PATCH | `/api/admin/visits[/{id}]` | admin |

## Production notes

- `ENV=prod` disables `/docs`. Set `TRUST_PROXY_HEADERS=true` behind Cloudflare/Nginx.
- Create Supabase buckets: `submissions` (private) and `listings` (public).
- Run a single uvicorn worker (rate limiter is in-process); scale up later with Redis if ever needed.
- Schedule `python -m app.cleanup` and a nightly `pg_dump` via cron.
