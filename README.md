# LandFinder

Property brokerage for Chengannur: verified listings, free to list, brokerage only when a sale
closes. Sellers' details are never shown publicly; buyers contact LandFinder.

```
backend/    FastAPI + SQLite API          → backend/README.md
frontend/   React + Vite + Tailwind app   → frontend/README.md
deploy/     server setup, update, backup and restore scripts
docs/       guides and plans
```

## Guides

| Guide | For |
|---|---|
| [docs/RUN_WINDOWS.md](docs/RUN_WINDOWS.md) | Run it on a Windows laptop (or double-click `start.bat`) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Put it online on AWS Lightsail, update it, back it up |
| [docs/V1_PLAN.md](docs/V1_PLAN.md) | Product plan |
| [docs/STATE_MACHINES.md](docs/STATE_MACHINES.md) | Every step-by-step flow (property, visit, search model, Sell form) and where its rules live |

## Checks

Every push runs the backend tests and lint and the frontend type check and build
(`.github/workflows/ci.yml`). To run them locally:

```bash
cd backend && pytest -q && ruff check . && ruff format --check .
cd frontend && npm run build
```

## Branches

Work happens on a work branch; `main` holds approved code, and the server runs `main`
(`sudo /opt/landfinder/deploy/update.sh`).
