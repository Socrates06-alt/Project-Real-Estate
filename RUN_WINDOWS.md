# Run Nilayam on Windows (no Docker)

## 1. Install once

- **Python 3.12+**: https://www.python.org/downloads/ (tick **"Add python.exe to PATH"**)
- **Node.js 22 LTS**: https://nodejs.org
- **Git**: https://git-scm.com/download/win
- **A database**, choose one:
  - **Supabase (recommended, nothing to install):** create a free project at https://supabase.com.
    In *Project Settings → Database → Connection string*, copy the **Session pooler** URI.
  - **Local PostgreSQL:** install from https://www.postgresql.org/download/windows/
    (remember the password), then in *SQL Shell (psql)* run `create database nilayam;`

## 2. Backend (first terminal)

Open **PowerShell** in the project folder:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env
notepad .env
```

In `.env` set at least:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nilayam
SUPABASE_JWT_SECRET=any-long-random-text-for-local-use-0123456789
```

(For Supabase, paste the Session pooler URI as `DATABASE_URL`, and the *JWT Secret*
from *Project Settings → API* as `SUPABASE_JWT_SECRET`.)

Then:

```powershell
python -m app.db                     # create tables
uvicorn app.main:app --reload        # API on http://localhost:8000
```

If PowerShell blocks `activate`, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 3. Frontend (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

## 4. Optional: sample listings (third terminal)

```powershell
cd backend
.venv\Scripts\activate
python -m scripts.seed_demo
```

## 5. Admin login

Admin (`http://localhost:5173/admin`) uses Supabase Auth:

1. In Supabase: *Authentication → Users → Add user* (your email + password).
2. Copy that user's **UID** and run in Supabase *SQL Editor*:
   `insert into admins (user_id, email) values ('<UID>', 'you@example.com');`
3. Create `frontend\.env.local`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Make sure the backend `.env` has the same project's `SUPABASE_URL` and `SUPABASE_JWT_SECRET`,
   then restart both terminals.

## Every next time

Terminal 1: `cd backend` → `.venv\Scripts\activate` → `uvicorn app.main:app --reload`
Terminal 2: `cd frontend` → `npm run dev`
