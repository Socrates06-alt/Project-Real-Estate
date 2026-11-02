@echo off
REM Starts LandFinder: backend (API) and frontend (web app) in two windows.
cd /d "%~dp0"

if not exist backend\.venv (
  echo First run: setting up backend...
  python -m venv backend\.venv || goto :error
  backend\.venv\Scripts\pip install -r backend\requirements.txt || goto :error
)
if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist frontend\node_modules (
  echo First run: installing frontend packages...
  pushd frontend & call npm install & popd
)

start "LandFinder backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\uvicorn app.main:app --reload"
start "LandFinder frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 6 >nul
start http://localhost:5173
exit /b 0

:error
echo Setup failed. Is Python installed and on PATH?
pause
