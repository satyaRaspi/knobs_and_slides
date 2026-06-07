# Knobs and Slides Studio 1.2.11 — Railway Docker Frontend Build Fixed

This build fixes the Railway deployment issues seen in the earlier Nixpacks builds.

## What changed in 1.2.11

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
git commit -m "Release Knobs and Slides Studio 1.2.11 Railway Docker Frontend Build Fixed"
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
Knobs and Slides Studio 1.2.11 — Railway Docker Frontend Build Fixed
```


## Railway Build Fix in 1.2.11

This version fixes the Railway Docker error where `/frontend/dist` was not found. The React frontend is now built inside Docker using a Node build stage, then copied into the final Python/FastAPI image. This means `frontend/dist` does not need to be committed to GitHub.

Railway deployment steps remain the same:

```bash
git add .
git commit -m "Fix Railway Docker frontend build for 1.2.11"
git push
```

Railway will rebuild using the included `Dockerfile`.

## Railway 1.2.11 fix

This version uses Docker and builds the React frontend inside the Docker image. The Dockerfile explicitly installs frontend build dependencies using:

```bash
npm ci --include=dev || npm install --include=dev
npm exec vite -- build
```

This fixes Railway build errors where `vite` was not found during `npm run build`.

## Railway 1.2.11 Fix Notes

This build hardens the Docker frontend build:

- Docker copies only `frontend/package.json` before installing dependencies.
- Docker does not rely on `frontend/package-lock.json`, because generated lock files may contain environment-specific registry URLs.
- React, ReactDOM, and Vite are verified in local `node_modules` before building.
- Docker uses `./node_modules/.bin/vite build` instead of `npm exec vite -- build`, preventing npm from downloading a temporary Vite version.

## Version 1.2.11 note — frontend npm install fix

This build removes the generated `frontend/package-lock.json` and `frontend/node_modules` from the ZIP because those can contain machine-specific or registry-specific metadata. The frontend now installs cleanly from the public npm registry.

If `npm install` appears to spin:

Windows:
```bat
fix_frontend_install_windows.bat
```

Mac:
```bash
chmod +x fix_frontend_install_mac.command
./fix_frontend_install_mac.command
```

Manual command:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund --legacy-peer-deps
npm run dev
```

## Windows frontend startup fix in 1.2.11

The Windows frontend startup script now uses `call npm ...` for every npm command. This is important on Windows because npm runs through `npm.cmd`; without `call`, a batch file can stop or behave unpredictably after the first npm command.

If the frontend does not start:

1. Double-click `fix_frontend_install_windows.bat`.
2. Then double-click `start_frontend_windows.bat`.
3. Keep the command window open.
4. Open `http://localhost:5173`.

## 1.2.11 API routing fix

If you see this browser error:

```text
Unexpected token '<', "<!doctype "... is not valid JSON
```

it means the frontend received the React HTML page instead of a JSON API response.

This version fixes that by using:

- `http://localhost:8000` automatically during local Vite development
- same-origin `/api/...` automatically in Railway production
- clearer error messages if an API route is misconfigured

For local use, keep both windows open:

1. `start_backend_windows.bat`
2. `start_frontend_windows.bat`

Then open `http://localhost:5173`.

## 1.2.11 Railway health-check fix

This version removes the Railway `startCommand` override and lets Docker run `python start.py`.
The Python startup script reads Railway's `PORT` variable directly, so the app does not depend on shell expansion of `$PORT`.

Health endpoints available:

- `/api/health`
- `/health`
- `/railway-health`

## Railway service unavailable health-check fix

Version 1.2.11 removes the Railway health-check gate from `railway.json` to avoid deployment failure loops while Railway is starting the container.

Important Railway settings:

1. Open Railway service → Settings.
2. Clear any custom **Start Command**. Leave it blank so Railway uses the Dockerfile `CMD`.
3. Confirm builder is Dockerfile.
4. Redeploy.

After deployment opens, check:

```text
https://your-railway-url/health
https://your-railway-url/api/health
```

If both return JSON, the app is running correctly.
