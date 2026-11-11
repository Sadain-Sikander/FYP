@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Backend environment missing. Create .venv and install requirements.txt first.
  exit /b 1
)
set "CAREERBRIDGE_PRELOAD_MODEL=1"
echo Preparing CareerBridge. Wait for [model] READY and Application startup complete.
echo Keep this window open. Press Ctrl+C to stop.
if exist ".env" (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000 --no-use-colors
) else (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-use-colors
)
exit /b %errorlevel%
