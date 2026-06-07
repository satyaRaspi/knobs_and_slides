# Knobs and Slides Studio 1.2.0 — Railway Ready Demo Build

This is the Railway-ready demo build of **Knobs and Slides Studio**.

It keeps the same product features from the 1.1.x line and adds a deployable production-style structure for Railway:

- FastAPI backend
- React/Vite frontend
- FastAPI serves the built React app from `frontend/dist`
- Same-origin API calls for deployment
- Railway `railway.json`
- `nixpacks.toml`
- Health check endpoint
- Railway-compatible `$PORT` handling
- SQLite demo database
- Simulated Bluetooth input engine
- Multiple knob configuration
- Knob maintenance with pair/unpair and activate/deactivate
- Clickable mapping maintenance
- Visual high-contrast simulator output
- Minimal Apple-like UI with tooltips

---

## Version

```text
Knobs and Slides Studio 1.2.0 — Railway Ready Demo Build
```

---

## Folder Structure

```text
knobs-and-slides-studio-1.2.0/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── mapping_engine.py
│   ├── bluetooth_adapter.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   └── package-lock.json
├── server.py
├── railway.json
├── nixpacks.toml
├── Procfile
├── start_backend_windows.bat
├── start_frontend_windows.bat
├── start_backend_mac.command
├── start_frontend_mac.command
└── README.md
```

---

## Local Run — Windows

1. Extract the ZIP.
2. Double-click:

```text
start_backend_windows.bat
```

3. Double-click:

```text
start_frontend_windows.bat
```

4. Open:

```text
http://localhost:5173
```

---

## Local Run — Mac

Open Terminal inside the extracted folder and run:

```bash
chmod +x start_backend_mac.command
chmod +x start_frontend_mac.command
./start_backend_mac.command
./start_frontend_mac.command
```

Then open:

```text
http://localhost:5173
```

---

## Local Production-Style Run

This runs the app closer to Railway mode, where FastAPI serves both backend API and frontend UI.

### Step 1 — Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### Step 2 — Build frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### Step 3 — Start one combined server

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000
```

API health check:

```text
http://localhost:8000/api/health
```

---

## Railway Deployment — GitHub Flow

### Step 1 — Create a GitHub repository

Create a new GitHub repository, for example:

```text
knobs-and-slides-studio
```

### Step 2 — Push this folder to GitHub

From inside the extracted folder:

```bash
git init
git add .
git commit -m "Release Knobs and Slides Studio 1.2.0 Railway Ready Demo Build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/knobs-and-slides-studio.git
git push -u origin main
```

### Step 3 — Create Railway project

1. Open Railway.
2. Create a new project.
3. Select **Deploy from GitHub repo**.
4. Choose your repository.
5. Railway will use the included `railway.json` and `nixpacks.toml`.

---

## Railway Build Command

The included Railway build command is:

```bash
pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build
```

This installs backend dependencies, installs frontend dependencies, and builds the React UI into:

```text
frontend/dist
```

---

## Railway Start Command

The included Railway start command is:

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Railway provides `$PORT` automatically.

---

## Health Check

Railway health check path:

```text
/api/health
```

Expected response:

```json
{
  "status": "OK",
  "name": "Knobs and Slides Studio",
  "version": "1.2.0"
}
```

---

## Important Railway Notes

### SQLite is included for demo use

This build uses SQLite for demo and investor presentation purposes.

For a production SaaS release, migrate to PostgreSQL.

### Optional persistent SQLite path

You can configure a Railway volume later and set this environment variable:

```text
KNOBS_DB_PATH=/data/knobs_slides.db
```

Without a persistent volume, Railway may not retain SQLite data permanently across rebuilds/redeploys.

---

## Main API Endpoints

```text
GET  /api/health
GET  /api/meta
GET  /api/devices
POST /api/devices
PUT  /api/devices/{device_id}
POST /api/devices/{device_id}/pair
POST /api/devices/{device_id}/unpair
POST /api/devices/{device_id}/activate
POST /api/devices/{device_id}/deactivate
DELETE /api/devices/{device_id}
GET  /api/applications
GET  /api/controls
GET  /api/mappings
POST /api/mappings
PUT  /api/mappings/{mapping_id}
POST /api/simulate-input
GET  /api/events
WS   /ws/events
```

---

## Demo Flow

1. Open the app.
2. Go to **Knob Maintenance**.
3. Confirm devices are active and paired.
4. Go to **Mappings**.
5. Click any mapping row to edit app/control mapping.
6. Go to **Simulator**.
7. Move knobs.
8. See live visual results update above each knob.

---

## Release Notes — 1.2.0

- Converted the app into a Railway-ready single-service build.
- FastAPI now serves the React production build.
- Frontend API calls default to same-origin URLs.
- WebSocket URL now works on deployed HTTPS Railway domains.
- Added `railway.json`.
- Added `nixpacks.toml`.
- Added root `server.py` entry point.
- Added production-style run instructions.
- Added Railway deployment instructions.
- Added optional `KNOBS_DB_PATH` for future persistent SQLite volume support.
