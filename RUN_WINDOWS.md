# Run Nilayam on Windows

No database, Docker or cloud account needed.

## 1. Install once

- **Python 3.12+**: https://www.python.org/downloads/ (tick **"Add python.exe to PATH"**)
- **Node.js 22 LTS**: https://nodejs.org
- **Git**: https://git-scm.com/download/win

## 2. Backend (first PowerShell window)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env                    # set ADMIN_PASSWORD to your own password
uvicorn app.main:app --reload
```

If PowerShell blocks `activate`, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 3. Frontend (second PowerShell window)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Admin: **http://localhost:5173/admin** (your ADMIN_PASSWORD).

## 4. Optional: sample listings (third window, backend running)

```powershell
cd backend
.venv\Scripts\activate
python seed_demo.py
```

## Every next time

Window 1: `cd backend` → `.venv\Scripts\activate` → `uvicorn app.main:app --reload`
Window 2: `cd frontend` → `npm run dev`

To start fresh, stop the backend and delete `backend\nilayam.db` and `backend\media`.
