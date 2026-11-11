# Recommendation startup and latency

Without preloading, Uvicorn's **Application startup complete** only means the API
has started. The first skill-suggestion, recommendation or semantic skill-gap
request then loads the encoder. A browser timeout does not prove the backend
never received the request: Uvicorn's access line is normally emitted when the
response starts. CareerBridge now logs receipt of skill/recommendation requests
before loading the model, without recording the submitted profile.

## Recommended Windows startup

Stop the previous backend with Ctrl+C. From `FYP\backend`, run:

```cmd
start.cmd
```

PowerShell uses `./start.cmd`. The script locates `.venv\Scripts\python.exe`
relative to itself, enables model preloading, and reads `.env` if present. It does
not create environments, install dependencies, alter keys or use auto-reload.
Wait for both `[model] READY` and **Application startup complete** before using
recommendations. If warm-up fails, this startup mode exits with an error instead
of announcing a model-ready service. Fix the reported stage and start again.

Manual CMD equivalent, with the virtual environment active:

```cmd
set CAREERBRIDGE_PRELOAD_MODEL=1
python -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000
```

## What the loader does

1. Imports the ML libraries and reports that stage immediately.
2. Tries the Hugging Face cache with `local_files_only=True`, avoiding network
   metadata checks when the complete model is already available.
3. If cache files are missing, attempts the initial online download. In explicit
   `HF_HUB_OFFLINE=1` mode it reports an incomplete cache instead.
4. Runs one test encoding and checks its shape and values before marking ready.

A lock prevents concurrent requests from loading separate model copies. Failed
loads have a 30-second retry cooldown. The same encoder serves later requests in
that process. Restarting the process still requires loading it into RAM, but
cached weights do not need to be downloaded again. Model imports, disk speed,
free RAM and CPU load affect local startup time; this is not an instant-start
guarantee. CPU thread count defaults to at most four to avoid excessive thread
overhead for small queries. The model and career vectors are unchanged.

A cloud CPU check with cached weights and `HF_HUB_OFFLINE=1` completed startup
warm-up in 3.66 seconds, then returned an IT recommendation request in 0.026 seconds,
skill suggestions in 0.617 seconds, and a skill-gap request in 0.142 seconds.
These are individual observations on the development machine, not a guarantee
for Windows hardware or an initial model download.

## Find the stalled stage

- **Importing ML libraries:** Python/PyTorch is still starting. Check available
  memory and other Python processes in Task Manager. Avoid launching duplicate
  backends. Do not disable antivirus or TLS checks as a workaround.
- **Loading cached weights:** files are being read from disk. A full cache and
  enough free memory are needed; a progress bar at 100% is not the final readiness
  signal until the test encoding completes.
- **Downloading:** the cache is incomplete. Keep internet access available for
  Hugging Face and its model-download hosts. Reuse the same Windows user and
  persistent `HF_HOME` directory across starts if you configured one.
- **READY but frontend still times out:** open
  `http://localhost:5173/api/model-status`. This tests the frontend's default Vite
  proxy. Also check `http://127.0.0.1:8000/api/model-status` directly. If only the
  direct URL works, inspect frontend proxy/API URL configuration. If neither
  works, check that the backend is still running on port 8000.

To isolate the model from HTTP/frontend issues, run this in the backend virtual
environment with the other backend stopped:

```cmd
python -m app.model_runtime
```

When reporting a problem, share the final model-stage message and the status
JSON, without API keys or `.env` contents. `/api/model-status` contains readiness
metadata only. It remains responsive during lazy loading; with startup preloading,
the HTTP server becomes available after the warm-up finishes.
