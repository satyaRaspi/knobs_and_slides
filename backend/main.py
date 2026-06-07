import json
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from database import get_conn, init_db, now_iso
from mapping_engine import map_value

APP_VERSION = "1.2.11"
APP_NAME = "Knobs and Slides Studio"

app = FastAPI(title=APP_NAME, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: list[WebSocket] = []

class SimulateInput(BaseModel):
    device_id: str = Field(..., examples=["KNOB_001"])
    relative_position: float = Field(..., ge=0, le=360, examples=[124.455])

class DeviceCreate(BaseModel):
    device_id: str
    device_name: str
    device_type: str = "knob"
    paired_status: str = "paired"
    status: str = "active"

class DeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    paired_status: Optional[str] = None

class MappingCreate(BaseModel):
    device_id: str
    application_id: int
    control_id: int
    input_min: float = 0
    input_max: float = 360
    output_min: float
    output_max: float
    mapping_type: str = "linear"
    is_active: int = 1

class MappingUpdate(BaseModel):
    device_id: Optional[str] = None
    application_id: Optional[int] = None
    control_id: Optional[int] = None
    input_min: Optional[float] = None
    input_max: Optional[float] = None
    output_min: Optional[float] = None
    output_max: Optional[float] = None
    mapping_type: Optional[str] = None
    is_active: Optional[int] = None

@app.on_event("startup")
def startup():
    init_db()


def rows(sql: str, params=()):
    conn = get_conn()
    cur = conn.execute(sql, params)
    data = [dict(r) for r in cur.fetchall()]
    conn.close()
    return data

async def broadcast(event: dict):
    dead = []
    for ws in clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in clients:
            clients.remove(ws)

DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/")
def root():
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"status": "OK", "name": APP_NAME, "version": APP_VERSION, "message": "Simulated Bluetooth Control Engine is running"}


@app.get("/api/health")
def health():
    return {"status": "OK", "name": APP_NAME, "version": APP_VERSION}

@app.get("/health")
def plain_health():
    return {"status": "OK"}

@app.get("/railway-health")
def railway_health():
    return {"status": "OK"}

@app.get("/api/meta")
def meta():
    return {"name": APP_NAME, "version": APP_VERSION, "release": "Railway Ready Demo Build"}

@app.get("/api/devices")
def get_devices():
    return rows("SELECT * FROM devices ORDER BY id")

@app.post("/api/devices")
def create_device(payload: DeviceCreate):
    conn = get_conn()
    paired_status = payload.paired_status if payload.paired_status in {"paired", "unpaired", "pairing"} else "paired"
    status = payload.status if payload.status in {"active", "inactive"} else "active"
    try:
        conn.execute(
            "INSERT INTO devices(device_id, device_name, device_type, connection_type, status, paired_status, last_seen_at, created_at) VALUES(?,?,?,?,?,?,?,?)",
            (payload.device_id, payload.device_name, payload.device_type, "simulated", status, paired_status, now_iso() if paired_status == "paired" else None, now_iso()),
        )
        conn.commit()
    except Exception as exc:
        conn.close()
        raise HTTPException(status_code=400, detail=str(exc))
    conn.close()
    return {"ok": True}

@app.put("/api/devices/{device_id}")
def update_device(device_id: str, payload: DeviceUpdate):
    allowed_status = {"active", "inactive"}
    allowed_pairing = {"paired", "unpaired", "pairing"}
    fields = []
    params = []
    if payload.device_name is not None:
        fields.append("device_name=?")
        params.append(payload.device_name)
    if payload.device_type is not None:
        fields.append("device_type=?")
        params.append(payload.device_type)
    if payload.status is not None:
        if payload.status not in allowed_status:
            raise HTTPException(status_code=400, detail="status must be active or inactive")
        fields.append("status=?")
        params.append(payload.status)
    if payload.paired_status is not None:
        if payload.paired_status not in allowed_pairing:
            raise HTTPException(status_code=400, detail="paired_status must be paired, unpaired, or pairing")
        fields.append("paired_status=?")
        params.append(payload.paired_status)
        fields.append("last_seen_at=?")
        params.append(now_iso() if payload.paired_status == "paired" else None)
    if not fields:
        return {"ok": True, "message": "No changes supplied"}
    params.append(device_id)
    conn = get_conn()
    cur = conn.execute(f"UPDATE devices SET {', '.join(fields)} WHERE device_id=?", params)
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True}

@app.post("/api/devices/{device_id}/deactivate")
def deactivate_device(device_id: str):
    conn = get_conn()
    cur = conn.execute("UPDATE devices SET status='inactive' WHERE device_id=?", (device_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True}

@app.post("/api/devices/{device_id}/activate")
def activate_device(device_id: str):
    conn = get_conn()
    cur = conn.execute("UPDATE devices SET status='active' WHERE device_id=?", (device_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True}

@app.post("/api/devices/{device_id}/pair")
def pair_device(device_id: str):
    conn = get_conn()
    cur = conn.execute("UPDATE devices SET paired_status='paired', last_seen_at=? WHERE device_id=?", (now_iso(), device_id))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True, "paired_status": "paired"}

@app.post("/api/devices/{device_id}/unpair")
def unpair_device(device_id: str):
    conn = get_conn()
    cur = conn.execute("UPDATE devices SET paired_status='unpaired', last_seen_at=NULL WHERE device_id=?", (device_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True, "paired_status": "unpaired"}

@app.delete("/api/devices/{device_id}")
def delete_device(device_id: str):
    conn = get_conn()
    device = conn.execute("SELECT * FROM devices WHERE device_id=?", (device_id,)).fetchone()
    if not device:
        conn.close()
        raise HTTPException(status_code=404, detail="Device not found")
    conn.execute("DELETE FROM mappings WHERE device_id=?", (device_id,))
    conn.execute("DELETE FROM input_events WHERE device_id=?", (device_id,))
    conn.execute("DELETE FROM devices WHERE device_id=?", (device_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": device_id}

@app.get("/api/applications")
def get_applications():
    return rows("SELECT * FROM applications ORDER BY app_name")

@app.get("/api/controls")
def get_controls(application_id: Optional[int] = None):
    if application_id:
        return rows("SELECT * FROM controls WHERE application_id=? ORDER BY control_name", (application_id,))
    return rows("SELECT c.*, a.app_name FROM controls c JOIN applications a ON a.id=c.application_id ORDER BY a.app_name, c.control_name")

@app.get("/api/mappings")
def get_mappings():
    return rows(
        """
        SELECT m.*, a.app_name, c.control_name, c.control_type, c.output_unit, c.precision
        FROM mappings m
        JOIN applications a ON a.id=m.application_id
        JOIN controls c ON c.id=m.control_id
        ORDER BY m.id
        """
    )

@app.post("/api/mappings")
def create_mapping(payload: MappingCreate):
    conn = get_conn()
    if payload.is_active:
        conn.execute("UPDATE mappings SET is_active=0 WHERE device_id=?", (payload.device_id,))
    conn.execute(
        """
        INSERT INTO mappings(device_id, application_id, control_id, input_min, input_max, output_min, output_max, mapping_type, is_active)
        VALUES(?,?,?,?,?,?,?,?,?)
        """,
        (payload.device_id, payload.application_id, payload.control_id, payload.input_min, payload.input_max,
         payload.output_min, payload.output_max, payload.mapping_type, payload.is_active),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.put("/api/mappings/{mapping_id}")
def update_mapping(mapping_id: int, payload: MappingUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM mappings WHERE id=?", (mapping_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Mapping not found")

    device_id = payload.device_id if payload.device_id is not None else existing["device_id"]
    application_id = payload.application_id if payload.application_id is not None else existing["application_id"]
    control_id = payload.control_id if payload.control_id is not None else existing["control_id"]
    input_min = payload.input_min if payload.input_min is not None else existing["input_min"]
    input_max = payload.input_max if payload.input_max is not None else existing["input_max"]
    output_min = payload.output_min if payload.output_min is not None else existing["output_min"]
    output_max = payload.output_max if payload.output_max is not None else existing["output_max"]
    mapping_type = payload.mapping_type if payload.mapping_type is not None else existing["mapping_type"]
    is_active = payload.is_active if payload.is_active is not None else existing["is_active"]

    if is_active:
        conn.execute("UPDATE mappings SET is_active=0 WHERE device_id=? AND id<>?", (device_id, mapping_id))

    conn.execute(
        """
        UPDATE mappings
        SET device_id=?, application_id=?, control_id=?, input_min=?, input_max=?, output_min=?, output_max=?, mapping_type=?, is_active=?
        WHERE id=?
        """,
        (device_id, application_id, control_id, input_min, input_max, output_min, output_max, mapping_type, is_active, mapping_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/mappings/{mapping_id}/activate")
def activate_mapping(mapping_id: int):
    conn = get_conn()
    m = conn.execute("SELECT * FROM mappings WHERE id=?", (mapping_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Mapping not found")
    conn.execute("UPDATE mappings SET is_active=0 WHERE device_id=?", (m["device_id"],))
    conn.execute("UPDATE mappings SET is_active=1 WHERE id=?", (mapping_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/simulate-input")
async def simulate_input(payload: SimulateInput):
    conn = get_conn()
    device = conn.execute("SELECT * FROM devices WHERE device_id=?", (payload.device_id,)).fetchone()
    if not device:
        conn.close()
        raise HTTPException(status_code=404, detail="Device not registered")
    if device["status"] != "active":
        conn.close()
        raise HTTPException(status_code=409, detail="Device is inactive. Activate it from Knob Maintenance.")
    if device["paired_status"] != "paired":
        conn.close()
        raise HTTPException(status_code=409, detail="Device is not Bluetooth paired in simulation. Pair it from Knob Maintenance.")
    conn.execute("UPDATE devices SET last_seen_at=? WHERE device_id=?", (now_iso(), payload.device_id))
    mapping = conn.execute(
        """
        SELECT m.*, a.app_name, c.control_name, c.output_unit, c.precision, c.control_type
        FROM mappings m
        JOIN applications a ON a.id=m.application_id
        JOIN controls c ON c.id=m.control_id
        WHERE m.device_id=? AND m.is_active=1
        ORDER BY m.id DESC LIMIT 1
        """,
        (payload.device_id,),
    ).fetchone()
    if not mapping:
        event = {
            "device_id": payload.device_id,
            "relative_position": payload.relative_position,
            "mapped_value": None,
            "application": None,
            "control": None,
            "unit": None,
            "display_value": "No active mapping",
            "created_at": now_iso(),
        }
    else:
        try:
            mapped = map_value(
                payload.relative_position,
                mapping["input_min"],
                mapping["input_max"],
                mapping["output_min"],
                mapping["output_max"],
                mapping["precision"],
                mapping["mapping_type"],
            )
        except ValueError as exc:
            conn.close()
            raise HTTPException(status_code=400, detail=str(exc))
        unit = mapping["output_unit"] or ""
        event = {
            "device_id": payload.device_id,
            "relative_position": payload.relative_position,
            "mapped_value": mapped,
            "application": mapping["app_name"],
            "control": mapping["control_name"],
            "control_type": mapping["control_type"],
            "unit": unit,
            "display_value": f"{mapped}{unit}",
            "created_at": now_iso(),
        }
    conn.execute(
        """
        INSERT INTO input_events(device_id, relative_position, mapped_value, application_name, control_name, output_unit, raw_payload, created_at)
        VALUES(?,?,?,?,?,?,?,?)
        """,
        (payload.device_id, payload.relative_position, event["mapped_value"], event["application"], event["control"], event["unit"], json.dumps(payload.model_dump()), event["created_at"]),
    )
    conn.commit()
    conn.close()
    await broadcast(event)
    return event

@app.get("/api/events")
def get_events(limit: int = 50):
    limit = min(max(limit, 1), 500)
    return rows("SELECT * FROM input_events ORDER BY id DESC LIMIT ?", (limit,))

@app.websocket("/ws/events")
async def events_ws(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in clients:
            clients.remove(websocket)


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    """Serve the React single-page app for Railway/browser refreshes.
    API and WebSocket routes are defined above and take precedence.
    """
    if full_path.startswith(("api/", "ws/", "assets/")):
        raise HTTPException(status_code=404, detail="Not found")
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found. Run: cd frontend && npm install && npm run build")
