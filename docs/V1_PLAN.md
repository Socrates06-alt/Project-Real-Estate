# Nilayam — V1 Build Plan

Technology-enabled real estate brokerage for one taluk around Chengannur, Kerala.
Free listings; brokerage on successful transactions (seller 2%, buyer 1%, + GST).

V1 goal: launch a working local brokerage, acquire real sellers and buyers,
coordinate deals manually, and validate the business model — on a lean modular
monolith costing under ₹2,000/month.

---

## 0. Current stage: prototype

The backend is currently a **lean prototype** (SQLite, one admin password, local photos) so it
runs on any laptop with just Python and Node. The API is the same one V1 will use. The road to V1:

1. SQLite → Supabase PostgreSQL (schema/triggers port 1:1; add RLS).
2. Admin password → Supabase Auth + `admins` allowlist.
3. Local photos → Supabase Storage (private originals, public published copies).
4. Rate limiting, Turnstile captcha, request size limits.
5. Audit log, structured logging, backups, cleanup job.
6. CI, deployment (VPS + Cloudflare).

The sections below describe the V1 target.

## 1. Architecture

```
frontend/            React + Vite + TS + Tailwind + shadcn (static build)
backend/             FastAPI modular monolith
  app/routers/       public · submissions · admin
  migrations/        plain SQL (schema, RLS, immutability triggers)
  tests/             pytest API tests (real Postgres)
infra/               docker-compose, Nginx, backup scripts   (later)
docs/                this plan
```

**Trust boundary**

- The browser never writes to the database. Every read/write goes through FastAPI.
- The frontend only talks to Supabase directly for **admin login** (to obtain a JWT).
- Public endpoints only ever select sanitized, published data. Seller name,
  phone and exact address never leave the server on public routes.
- Admin endpoints verify the Supabase JWT **and** an `admins` allowlist on every request.
- RLS is enabled on every table with no policies, and `anon`/`authenticated`
  roles have all grants revoked — a leaked anon key can read nothing.

## 2. Data model

| Table | Purpose |
|---|---|
| `submissions` | Original seller submission. **Immutable** (trigger) — only the workflow `status` columns may change. Stores consent version + timestamp, device-token hash, salted IP hash. |
| `listings` | Public number (`#1001`…), admin-managed sanitized draft (title, general location, price, photos…) and lifecycle state: `draft → published → sold / withdrawn`. |
| `published_versions` | Insert-only JSON snapshot per publish (trigger blocks UPDATE/DELETE). Public pages read the latest version. |
| `listing_photos` | Storage references. `original` photos (private bucket) belong to a submission; `public` copies belong to a listing. |
| `visit_requests` | Buyer visit requests and their manual-coordination status. |
| `admins` | Allowlist of the 2 founder user IDs. |
| `audit_events` | Who did what (publish, price confirmation, sold…). |

**Material price change rule:** publishing a price that differs by more than
`MATERIAL_PRICE_CHANGE_PCT` (default 5%) from the last published price (or the
seller's expected price on first publish) requires a recorded seller
confirmation for that exact price.

## 3. Screens → API

| Screen | Endpoints |
|---|---|
| Explore | `GET /api/listings?q=&type=&status=live\|sold\|all` |
| Property Details | `GET /api/listings/{id}`, `POST /api/listings/{id}/visit-requests` |
| Seller Submission | `GET /api/config`, `POST /api/submissions` (multipart, 1–3 photos) |
| Profile | `GET /api/my/submissions` (header `X-Device-Token`) |
| Admin | `/api/admin/*` — queue, drafts, publish, price confirmation, sold, visits |

**Search (no AI in V1):** a rule-based parser turns queries like
“house under 40 lakh near Mulakuzha 10 cents” into structured filters, plus
Postgres full-text and trigram matching on the remaining words.

**Device-specific “My Listings”:** the browser generates a random token kept
in localStorage; only its SHA-256 hash is stored. Sellers also receive a
reference code (e.g. `NLY-7K3QPA`) to quote when contacting Nilayam.

## 4. Photos

1. Upload goes through FastAPI only: max 3 files, 8 MB each, request body capped.
2. The real image type is detected from file content (JPEG, PNG, WebP), not the filename or MIME header.
3. Every photo is decoded and **re-encoded to WebP with Pillow**. This strips all EXIF data, including GPS, which would otherwise leak the exact address. Decompression bombs are rejected.
4. Originals are stored in a **private** bucket; admins view them through an authenticated endpoint.
5. On publish, the photos the admin selected are copied to a **public** bucket and served through Cloudflare.
6. A cleanup job deletes original photos of rejected submissions after a retention period.

## 5. Admin access & user journeys

- Public app has no link to admin. Admin lives on its own URL/subdomain
  (optionally behind Cloudflare Access, free).
- Login is Supabase Auth with founder accounts created by hand (no sign-up).
- **Every** admin API call re-checks the JWT and the `admins` allowlist on the
  server; anyone else gets 401/403 and no data.

**Seller:** Sell → fill details + 1–3 photos → accept brokerage terms → submit →
receives reference code → tracks status in Profile (Received → Under review →
Listed → Sold) → founders call to verify.

**Admin:** login → submission queue → create sanitized draft → edit / choose
photos → (seller price confirmation if needed) → publish (snapshot) → manage
visit requests → mark sold.

**Buyer:** Explore → search/filter → property details (no seller identity or
exact address) → Call/WhatsApp Nilayam's central number or Request Visit.

**Deal:** founders coordinate visit, negotiation and documents offline,
collect brokerage outside the app, then mark the listing sold.

## 6. Production requirements

- Admin authN/authZ; RLS + revoked grants; immutability triggers.
- Rate limiting (in-process per IP + Cloudflare rules) and optional Cloudflare
  Turnstile on public forms.
- Request size limits; strict input validation; strict CORS.
- Structured JSON logs with request IDs; no phone numbers in logs.
- HTTPS via Cloudflare (Full strict) → Nginx → Uvicorn; firewall allows Cloudflare IPs only.
- Nightly encrypted `pg_dump` off-site + monthly restore drill.
- Automated API tests (pytest, real Postgres) and Playwright E2E; GitHub Actions CI.

## 7. Monthly cost (target < ₹2,000)

| Item | ₹/month |
|---|---|
| VPS (2 vCPU / 2–4 GB) | 500–900 |
| Supabase free tier | 0 |
| Cloudflare free + Turnstile | 0 |
| Domain | ~80 |

Risk: Supabase free projects pause after ~1 week of inactivity and storage is
1 GB. Mitigate with real traffic plus a keep-alive ping. Supabase Pro (~₹2,100)
alone would exceed budget; fallback is self-hosted Postgres on the VPS.

## 8. Milestones

1. ✅ **Backend foundation:** schema, RLS, triggers, public, submission and admin APIs, tests, CI.
2. ✅ Seller flow UI (submission + Profile).
3. ✅ Admin UI.
4. ✅ Buyer UI (Explore, Details, visits).
5. Hardening: Turnstile, backups, cleanup cron, E2E tests.
6. Deploy (VPS + Cloudflare) and soft launch.

## 9. Open questions

1. Kerala RERA agent registration, GST registration, DPDP Act consent and retention wording. Confirm with a CA or lawyer.
2. Is in-app consent enough for the brokerage agreement, or is a signed or WhatsApp-confirmed copy also needed?
3. Language: English only, or English + Malayalam?
4. Threshold for a "material" price change (default 5%).
5. ~~General location~~ — free text in V1 (per prototype).
6. VPS provider and plan size.

## 10. Out of scope for V1

Flat/commercial property types, customer login/OTP, online payments, automated valuation, AI semantic search,
marketing/maintenance services, automated visit scheduling, expansion beyond the taluk.
