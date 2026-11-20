# LandFinder — notes for Claude

Property brokerage for Chengannur, Kerala (a parent-and-child family business). Live: https://landfinder.online
(AWS Lightsail, 2 GB). Commission: seller 2%, buyer 1%. Most visitors come from Facebook.

## Working rules
- Commit and push only to the work branch the session names. **Never merge unless the user says "merge".** No PRs.
- On "merge": `git fetch -q origin main && git merge-base --is-ancestor origin/main HEAD && git push -q origin HEAD:main`,
  then tell the user to run `sudo /opt/landfinder/deploy/update.sh` on the server.
- The user wants short, plain-language answers, and screenshots of UI changes (Playwright, 390 px wide).
  The users are Indians aged 35+: simple and readable, English + Malayalam.
- Ad plans (₹199/₹499) were built and then removed (commit ada5351). Their DB columns are kept, unused. Don't rebuild them unless asked.

## Layout
- `backend/` FastAPI + SQLite. One folder per feature under `app/`; shared code in `app/core/`. See backend/README.md.
- `frontend/` React + Vite + TS + Tailwind. `features/*` never import each other; shared code goes in `shared/`.
- `deploy/` server scripts (setup, update, backup, restore). `docs/` guides.

## Gotchas
- Schema: bump `SCHEMA_VERSION` and add `UPGRADES[n]` in `core/migrations.py` (use `_add_column`). Never drop columns.
- Property lifecycle rules live only in `backend/app/admin/lifecycle.py` (docs/STATE_MACHINES.md).
- Property numbers start at 1001. Removed ones are parked at 9001+ (`PARKED_FROM`, `renumber.py`).
- Text goes through `t()` with keys in `shared/i18n/en.ts` and `ml.ts`; keep Malayalam short, it overflows easily.
- Sheets/dialogs inside forms: render with `createPortal`.
- Land price is entered per cent (total = per cent × cents). In the admin editor, changing the size never changes the price.
- Visitor counts are real from 10 Nov 2026; source tracking started 12 Nov.

## Checks
`cd backend && pytest -q && ruff check .` · `cd frontend && npm run build`
(Known: `test_visits_from_before_tracking_have_their_own_row` fails; it's date-dependent and was already failing.)
