# Knobs and Slides Studio 1.2.2 — Railway Docker Demo Build

This build fixes the Railway deployment issues seen in the earlier Nixpacks builds.

## What changed in 1.2.2

- Uses a `Dockerfile` for Railway deployment.
- Avoids the Railway/Nixpacks `pip: command not found` issue.
- Uses `python -m pip` inside Docker.
- Serves the already-built React frontend from FastAPI.
- Keeps the API and frontend in one Railway service.
- Keeps `/api/health` as the Railway health check.
- Keeps SQLite for demo deployment.

## Railway Deployment Steps

1. Extract this ZIP.
2. Copy the extracted files into your GitHub repo folder.
3. Commit and push:

```bash
git add .
git commit -m "Release Knobs and Slides Studio 1.2.2 Railway Docker Demo Build"
git push
```

4. In Railway, open your project.
5. Make sure the service uses the latest GitHub commit.
6. Redeploy.

Railway should now build using the included `Dockerfile` instead of the Nixpacks Python/npm build flow.

## Important Railway Settings

No extra environment variables are required for the demo.

Optional:

```text
KNOBS_DB_PATH=/app/data/knobs_slides.db
```

Use this only if you later attach a persistent Railway volume.

## Local Run — Windows

```bat
start_backend_windows.bat
start_frontend_windows.bat
```

Open:

```text
http://localhost:5173
```

## Local Run — Mac

```bash
chmod +x start_backend_mac.command
chmod +x start_frontend_mac.command
./start_backend_mac.command
./start_frontend_mac.command
```

Open:

```text
http://localhost:5173
```

## Railway Runtime

On Railway, open the generated Railway URL directly. The FastAPI backend serves the React UI from:

```text
/
```

The API health endpoint is:

```text
/api/health
```

## Features retained

- Apple-like minimal UI.
- Tooltip-based cleaner screens.
- Multi-knob simulator.
- Visual simulator output.
- High-contrast simulated values.
- Touch pair/unpair and switch-off controls.
- Clickable knob maintenance rows.
- Clickable mapping maintenance rows.
- Realistic control presets for Photoshop, Premiere Pro, and Logic Pro.
- Same backend mapping engine.

## Version

```text
Knobs and Slides Studio 1.2.2 — Railway Docker Demo Build
```
