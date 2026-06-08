import json
import re
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from database import get_conn, init_db, now_iso
from mapping_engine import map_value

APP_VERSION = "1.2.36"
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

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = ''
    role: str = 'user'
    status: str = 'active'

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

class LeadCreate(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str = ''
    company: str = ''
    role_use_case: str = ''
    client_date: str = ''
    client_time: str = ''
    client_timezone: str = ''
    client_locale: str = ''
    os: str = ''
    device_type: str = ''
    browser: str = ''
    platform: str = ''
    screen_size: str = ''
    region: str = ''
    referrer: str = ''
    user_agent: str = ''


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    role_use_case: Optional[str] = None
    source: Optional[str] = None
    region: Optional[str] = None
    os: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    client_timezone: Optional[str] = None
    client_locale: Optional[str] = None
    platform: Optional[str] = None
    screen_size: Optional[str] = None
    referrer: Optional[str] = None

class TextConfigUpdate(BaseModel):
    text_value: str

class TextConfigBulkUpdate(BaseModel):
    items: list[Dict[str, Any]]


PUBLIC_API_PATHS = {
    "/api/auth/login",
    "/api/auth/me",
    "/api/health",
    "/api/meta",
    "/api/text-config",
}

PUBLIC_API_METHOD_PATHS = {
    ("POST", "/api/leads"),  # public landing-page lead capture only
}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def sanitize_user(row):
    if not row:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "role": row["role"],
        "status": row["status"],
        "last_login_at": row["last_login_at"],
        "created_at": row["created_at"],
    }

def user_from_token(token: str):
    if not token:
        return None
    conn = get_conn()
    row = conn.execute(
        """
        SELECT u.* FROM auth_sessions s
        JOIN users u ON u.id=s.user_id
        WHERE s.token=? AND s.expires_at>? AND u.status='active'
        """,
        (token, now_iso()),
    ).fetchone()
    conn.close()
    return row

def token_from_request(request: Request) -> str:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return ""

def require_admin(request: Request):
    user = user_from_token(token_from_request(request))
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@app.middleware("http")
async def api_auth_guard(request: Request, call_next):
    path = request.url.path
    if (
        request.method == "OPTIONS"
        or not path.startswith("/api/")
        or path in PUBLIC_API_PATHS
        or (request.method, path) in PUBLIC_API_METHOD_PATHS
    ):
        return await call_next(request)
    token = token_from_request(request)
    if not user_from_token(token):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Login required"}, status_code=401)
    return await call_next(request)

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
    return {"name": APP_NAME, "version": APP_VERSION, "release": "Clean Leads Table Link Fixed"}


@app.post("/api/leads")
def create_lead(payload: LeadCreate, request: Request):
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()
    password = payload.password.strip()
    if not full_name or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid name and email")
    if not re.fullmatch(r"[A-Za-z0-9]{6}", password):
        raise HTTPException(status_code=400, detail="Password must be exactly 6 letters/numbers")

    conn = get_conn()
    created = now_iso()
    client_host = request.client.host if request.client else ''
    user_agent = payload.user_agent.strip() or request.headers.get("user-agent", "")
    cur = conn.execute(
        """
        INSERT INTO leads(
            full_name, email, phone, company, role_use_case, source, created_at,
            client_date, client_time, client_timezone, client_locale, os, device_type,
            browser, platform, screen_size, region, referrer, user_agent, ip_address
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            full_name, email, payload.phone.strip(), payload.company.strip(), payload.role_use_case.strip(),
            "landing_page", created, payload.client_date.strip(), payload.client_time.strip(),
            payload.client_timezone.strip(), payload.client_locale.strip(), payload.os.strip(),
            payload.device_type.strip(), payload.browser.strip(), payload.platform.strip(), payload.screen_size.strip(),
            payload.region.strip(), payload.referrer.strip(), user_agent, client_host
        ),
    )
    lead_id = cur.lastrowid

    existing = conn.execute("SELECT * FROM users WHERE username=?", (email,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE users SET password_hash=?, full_name=?, role='user', status='active' WHERE username=?",
            (hash_password(password), full_name, email),
        )
        user_id = existing["id"]
    else:
        user_cur = conn.execute(
            "INSERT INTO users(username, password_hash, full_name, role, status, created_at) VALUES(?,?,?,?,?,?)",
            (email, hash_password(password), full_name, "user", "active", created),
        )
        user_id = user_cur.lastrowid

    token = secrets.token_urlsafe(32)
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat(timespec="seconds") + "Z"
    conn.execute("INSERT INTO auth_sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)", (token, user_id, created, expires))
    conn.execute("UPDATE users SET last_login_at=? WHERE id=?", (created, user_id))
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return {"status": "OK", "lead_id": lead_id, "token": token, "user": sanitize_user(user), "message": "Demo user created"}

@app.get("/api/leads")
def get_leads(request: Request, limit: int = 200):
    require_admin(request)
    limit = min(max(limit, 1), 1000)
    return rows("SELECT * FROM leads ORDER BY id DESC LIMIT ?", (limit,))


@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: int, payload: LeadUpdate, request: Request):
    require_admin(request)
    allowed = [
        "full_name", "email", "phone", "company", "role_use_case", "source", "region",
        "os", "device_type", "browser", "client_timezone", "client_locale",
        "platform", "screen_size", "referrer"
    ]
    updates = []
    values = []
    for field in allowed:
        value = getattr(payload, field)
        if value is not None:
            updates.append(f"{field}=?")
            values.append(str(value).strip())
    if not updates:
        return {"ok": True, "message": "No changes"}
    values.append(lead_id)
    conn = get_conn()
    cur = conn.execute(f"UPDATE leads SET {', '.join(updates)} WHERE id=?", values)
    conn.commit()
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
    conn.close()
    return dict(lead)

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: int, request: Request):
    require_admin(request)
    conn = get_conn()
    cur = conn.execute("DELETE FROM leads WHERE id=?", (lead_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}

@app.post("/api/leads/delete-bulk")
def delete_leads_bulk(payload: Dict[str, Any], request: Request):
    require_admin(request)
    ids = payload.get("ids", []) if isinstance(payload, dict) else []
    clean_ids = [int(x) for x in ids if str(x).isdigit()]
    if not clean_ids:
        return {"ok": True, "deleted": 0}
    placeholders = ",".join(["?"] * len(clean_ids))
    conn = get_conn()
    cur = conn.execute(f"DELETE FROM leads WHERE id IN ({placeholders})", clean_ids)
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return {"ok": True, "deleted": deleted}

@app.get("/api/text-config")
def get_text_config():
    return rows("SELECT id, text_key, category, label, text_value, updated_at FROM text_config ORDER BY category, text_key")

@app.put("/api/text-config/{text_key}")
def update_text_config(text_key: str, payload: TextConfigUpdate, request: Request):
    require_admin(request)
    conn = get_conn()
    now = now_iso()
    cur = conn.execute("UPDATE text_config SET text_value=?, updated_at=? WHERE text_key=?", (payload.text_value, now, text_key))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Text key not found")
    return {"ok": True}

@app.put("/api/text-config")
def bulk_update_text_config(payload: TextConfigBulkUpdate, request: Request):
    require_admin(request)
    conn = get_conn()
    now = now_iso()
    for item in payload.items:
        key = str(item.get("text_key", "")).strip()
        if not key:
            continue
        conn.execute("UPDATE text_config SET text_value=?, updated_at=? WHERE text_key=?", (str(item.get("text_value", "")), now, key))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    conn = get_conn()
    user = conn.execute("SELECT * FROM users WHERE username=?", (payload.username.strip(),)).fetchone()
    if not user or user["password_hash"] != hash_password(payload.password) or user["status"] != "active":
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_urlsafe(32)
    created = now_iso()
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat(timespec="seconds") + "Z"
    conn.execute("INSERT INTO auth_sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)", (token, user["id"], created, expires))
    conn.execute("UPDATE users SET last_login_at=? WHERE id=?", (created, user["id"]))
    conn.commit()
    fresh = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    conn.close()
    return {"token": token, "user": sanitize_user(fresh)}

@app.get("/api/auth/me")
def me(request: Request):
    user = user_from_token(token_from_request(request))
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    return {"user": sanitize_user(user)}

@app.post("/api/auth/logout")
def logout(request: Request):
    token = token_from_request(request)
    conn = get_conn()
    conn.execute("DELETE FROM auth_sessions WHERE token=?", (token,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/users")
def list_users(request: Request):
    require_admin(request)
    return rows("SELECT id, username, full_name, role, status, last_login_at, created_at FROM users ORDER BY id")

@app.post("/api/users")
def create_user(payload: UserCreate, request: Request):
    require_admin(request)
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    role = payload.role if payload.role in {"admin", "user"} else "user"
    status = payload.status if payload.status in {"active", "inactive"} else "active"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users(username, password_hash, full_name, role, status, created_at) VALUES(?,?,?,?,?,?)",
            (payload.username.strip(), hash_password(payload.password), payload.full_name.strip(), role, status, now_iso()),
        )
        conn.commit()
    except Exception as exc:
        conn.close()
        raise HTTPException(status_code=400, detail=str(exc))
    conn.close()
    return {"ok": True}

@app.put("/api/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, request: Request):
    require_admin(request)
    fields = []
    params = []
    if payload.full_name is not None:
        fields.append("full_name=?")
        params.append(payload.full_name.strip())
    if payload.role is not None:
        if payload.role not in {"admin", "user"}:
            raise HTTPException(status_code=400, detail="role must be admin or user")
        fields.append("role=?")
        params.append(payload.role)
    if payload.status is not None:
        if payload.status not in {"active", "inactive"}:
            raise HTTPException(status_code=400, detail="status must be active or inactive")
        fields.append("status=?")
        params.append(payload.status)
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        fields.append("password_hash=?")
        params.append(hash_password(payload.password))
    if not fields:
        return {"ok": True}
    params.append(user_id)
    conn = get_conn()
    cur = conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", params)
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, request: Request):
    admin = require_admin(request)
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete the currently logged-in admin user")
    conn = get_conn()
    conn.execute("DELETE FROM auth_sessions WHERE user_id=?", (user_id,))
    cur = conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

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
