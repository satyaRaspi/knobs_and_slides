import os
import sqlite3
import hashlib
from pathlib import Path
from datetime import datetime

DB_PATH = Path(os.getenv("KNOBS_DB_PATH", Path(__file__).parent / "knobs_slides.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            device_name TEXT NOT NULL,
            device_type TEXT NOT NULL DEFAULT 'knob',
            connection_type TEXT NOT NULL DEFAULT 'simulated',
            status TEXT NOT NULL DEFAULT 'active',
            paired_status TEXT NOT NULL DEFAULT 'paired',
            last_seen_at TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT NOT NULL,
            app_key TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS controls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            control_name TEXT NOT NULL,
            control_type TEXT NOT NULL DEFAULT 'slider',
            output_min REAL NOT NULL DEFAULT 0,
            output_max REAL NOT NULL DEFAULT 100,
            output_unit TEXT DEFAULT '%',
            precision INTEGER NOT NULL DEFAULT 3,
            FOREIGN KEY(application_id) REFERENCES applications(id)
        );

        CREATE TABLE IF NOT EXISTS mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            application_id INTEGER NOT NULL,
            control_id INTEGER NOT NULL,
            input_min REAL NOT NULL DEFAULT 0,
            input_max REAL NOT NULL DEFAULT 360,
            output_min REAL NOT NULL DEFAULT 0,
            output_max REAL NOT NULL DEFAULT 100,
            mapping_type TEXT NOT NULL DEFAULT 'linear',
            is_active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(application_id) REFERENCES applications(id),
            FOREIGN KEY(control_id) REFERENCES controls(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            last_login_at TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS input_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            relative_position REAL NOT NULL,
            mapped_value REAL,
            application_name TEXT,
            control_name TEXT,
            output_unit TEXT,
            raw_payload TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    created = now_iso()
    # Safe migration path for users upgrading from 1.1.2 or older SQLite files.
    existing_cols = [r[1] for r in cur.execute("PRAGMA table_info(devices)").fetchall()]
    if "paired_status" not in existing_cols:
        cur.execute("ALTER TABLE devices ADD COLUMN paired_status TEXT NOT NULL DEFAULT 'paired'")
    if "last_seen_at" not in existing_cols:
        cur.execute("ALTER TABLE devices ADD COLUMN last_seen_at TEXT")
    # Prebuilt admin user for URL protection and user management.
    admin_hash = hashlib.sha256("admin123$".encode("utf-8")).hexdigest()
    cur.execute(
        "INSERT OR IGNORE INTO users(username, password_hash, full_name, role, status, created_at) VALUES(?,?,?,?,?,?)",
        ("admin", admin_hash, "System Administrator", "admin", "active", created),
    )

    conn.commit()
    seed_db(conn)
    conn.close()


def seed_db(conn):
    cur = conn.cursor()
    created = now_iso()

    # Base simulated devices. INSERT OR IGNORE keeps upgrades safe.
    devices = [
        ("KNOB_001", "Primary Precision Knob", "knob", "simulated", "active", "paired", created, created),
        ("KNOB_002", "Secondary Precision Knob", "knob", "simulated", "active", "paired", created, created),
        ("KNOB_003", "Creative Adjustment Knob", "knob", "simulated", "active", "paired", created, created),
        ("SLIDER_001", "Timeline / Range Slider", "slider", "simulated", "active", "paired", created, created),
        ("KNOB_004", "Color Temperature Knob", "knob", "simulated", "active", "paired", created, created),
        ("KNOB_005", "Brush / Tool Size Knob", "knob", "simulated", "inactive", "unpaired", None, created),
        ("KNOB_006", "Audio FX Knob", "knob", "simulated", "active", "pairing", None, created),
    ]
    cur.executemany(
        "INSERT OR IGNORE INTO devices(device_id, device_name, device_type, connection_type, status, paired_status, last_seen_at, created_at) VALUES(?,?,?,?,?,?,?,?)",
        devices,
    )
    apps = [
        ("Photoshop", "photoshop", "Photo editing controls for tonal, color, brush, layer and view adjustments"),
        ("Premiere Pro", "premiere", "Video editing controls for timeline, clip, audio and Lumetri-style adjustments"),
        ("Logic Pro", "logic", "Audio production controls for mixer, transport, smart controls, effects and automation"),
        ("Custom App", "custom", "Generic mapped output for testing and custom integrations"),
    ]
    cur.executemany("INSERT OR IGNORE INTO applications(app_name, app_key, description) VALUES(?,?,?)", apps)
    cur.execute("SELECT id, app_key FROM applications")
    app_ids = {r["app_key"]: r["id"] for r in cur.fetchall()}

    controls_by_app = {
        "photoshop": [
            ("Brightness", "slider", 0, 100, "%", 3),
            ("Contrast", "slider", -100, 100, "", 3),
            ("Exposure", "slider", -5, 5, "EV", 2),
            ("Gamma Correction", "slider", 0.1, 9.99, "", 2),
            ("Hue", "knob", -180, 180, "°", 1),
            ("Saturation", "slider", -100, 100, "%", 1),
            ("Lightness", "slider", -100, 100, "%", 1),
            ("Vibrance", "slider", -100, 100, "%", 1),
            ("Color Temperature", "slider", 2000, 10000, "K", 0),
            ("Tint", "slider", -150, 150, "", 0),
            ("Layer Opacity", "slider", 0, 100, "%", 1),
            ("Layer Fill", "slider", 0, 100, "%", 1),
            ("Brush Size", "knob", 1, 500, "px", 1),
            ("Brush Hardness", "slider", 0, 100, "%", 1),
            ("Brush Opacity", "slider", 0, 100, "%", 1),
            ("Brush Flow", "slider", 0, 100, "%", 1),
            ("Eraser Size", "knob", 1, 500, "px", 1),
            ("Clone Stamp Size", "knob", 1, 500, "px", 1),
            ("Blur Radius", "slider", 0, 250, "px", 1),
            ("Sharpen Amount", "slider", 0, 500, "%", 0),
            ("Noise Reduction", "slider", 0, 100, "%", 1),
            ("Levels Black Point", "slider", 0, 255, "", 0),
            ("Levels Midtone", "slider", 0.1, 9.99, "", 2),
            ("Levels White Point", "slider", 0, 255, "", 0),
            ("Canvas Rotation", "knob", -180, 180, "°", 1),
            ("Zoom", "slider", 12.5, 6400, "%", 1),
        ],
        "premiere": [
            ("Timeline Scrub", "slider", 0, 100, "%", 3),
            ("Timeline Zoom", "slider", 0, 100, "%", 1),
            ("Program Monitor Zoom", "slider", 10, 400, "%", 1),
            ("Clip Opacity", "slider", 0, 100, "%", 1),
            ("Clip Scale", "slider", 0, 500, "%", 1),
            ("Position X", "slider", -3840, 3840, "px", 0),
            ("Position Y", "slider", -2160, 2160, "px", 0),
            ("Rotation", "knob", -180, 180, "°", 1),
            ("Anchor Point X", "slider", -3840, 3840, "px", 0),
            ("Anchor Point Y", "slider", -2160, 2160, "px", 0),
            ("Audio Clip Gain", "knob", -30, 30, "dB", 1),
            ("Track Volume", "slider", -60, 12, "dB", 1),
            ("Audio Pan", "knob", -100, 100, "", 0),
            ("Lumetri Exposure", "slider", -5, 5, "EV", 2),
            ("Lumetri Contrast", "slider", -100, 100, "", 1),
            ("Lumetri Highlights", "slider", -100, 100, "", 1),
            ("Lumetri Shadows", "slider", -100, 100, "", 1),
            ("Lumetri Whites", "slider", -100, 100, "", 1),
            ("Lumetri Blacks", "slider", -100, 100, "", 1),
            ("Lumetri Saturation", "slider", 0, 200, "%", 1),
            ("Lumetri Temperature", "slider", -100, 100, "", 1),
            ("Lumetri Tint", "slider", -100, 100, "", 1),
            ("Gaussian Blur", "slider", 0, 300, "px", 1),
            ("Clip Speed", "slider", 1, 400, "%", 1),
            ("Transition Duration", "slider", 0, 5, "s", 2),
        ],
        "logic": [
            ("Master Volume", "knob", -60, 6, "dB", 2),
            ("Selected Track Volume", "slider", -60, 6, "dB", 2),
            ("Selected Track Pan", "knob", -64, 63, "", 0),
            ("Send Level 1", "slider", -60, 6, "dB", 2),
            ("Send Level 2", "slider", -60, 6, "dB", 2),
            ("Smart Control 1", "knob", 0, 100, "%", 1),
            ("Smart Control 2", "knob", 0, 100, "%", 1),
            ("Smart Control 3", "knob", 0, 100, "%", 1),
            ("Smart Control 4", "knob", 0, 100, "%", 1),
            ("Smart Control 5", "knob", 0, 100, "%", 1),
            ("Smart Control 6", "knob", 0, 100, "%", 1),
            ("Smart Control 7", "knob", 0, 100, "%", 1),
            ("Smart Control 8", "knob", 0, 100, "%", 1),
            ("EQ Low Gain", "slider", -24, 24, "dB", 1),
            ("EQ Mid Gain", "slider", -24, 24, "dB", 1),
            ("EQ High Gain", "slider", -24, 24, "dB", 1),
            ("Filter Cutoff", "knob", 20, 20000, "Hz", 0),
            ("Filter Resonance", "slider", 0, 100, "%", 1),
            ("Compressor Threshold", "slider", -60, 0, "dB", 1),
            ("Compressor Ratio", "slider", 1, 20, ":1", 1),
            ("Reverb Wet Level", "slider", 0, 100, "%", 1),
            ("Delay Feedback", "slider", 0, 100, "%", 1),
            ("Region Gain", "slider", -30, 30, "dB", 1),
            ("Tempo", "slider", 40, 240, "BPM", 1),
            ("Playback Scrub", "slider", 0, 100, "%", 3),
            ("Automation Trim", "slider", -100, 100, "%", 1),
        ],
        "custom": [
            ("Generic Value", "slider", 0, 100, "%", 3),
            ("Generic Bipolar Value", "knob", -100, 100, "%", 3),
            ("Generic Fine Value", "slider", 0, 1, "", 3),
        ],
    }

    for app_key, controls in controls_by_app.items():
        app_id = app_ids[app_key]
        for name, ctype, omin, omax, unit, precision in controls:
            exists = cur.execute(
                "SELECT id FROM controls WHERE application_id=? AND control_name=?",
                (app_id, name),
            ).fetchone()
            if not exists:
                cur.execute(
                    "INSERT INTO controls(application_id, control_name, control_type, output_min, output_max, output_unit, precision) VALUES(?,?,?,?,?,?,?)",
                    (app_id, name, ctype, omin, omax, unit, precision),
                )

    def control(app_key, name):
        return cur.execute(
            "SELECT c.* FROM controls c JOIN applications a ON a.id=c.application_id WHERE a.app_key=? AND c.control_name=?",
            (app_key, name),
        ).fetchone()

    # Starter mappings. Insert only if no mapping exists for the device.
    starter = [
        ("KNOB_001", "photoshop", "Brightness", "linear"),
        ("KNOB_002", "photoshop", "Contrast", "linear"),
        ("KNOB_003", "logic", "Master Volume", "linear"),
        ("SLIDER_001", "premiere", "Timeline Scrub", "linear"),
        ("KNOB_004", "photoshop", "Color Temperature", "linear"),
        ("KNOB_005", "photoshop", "Brush Size", "linear"),
        ("KNOB_006", "logic", "Reverb Wet Level", "linear"),
    ]
    for device_id, app_key, control_name, mapping_type in starter:
        exists = cur.execute("SELECT id FROM mappings WHERE device_id=?", (device_id,)).fetchone()
        c = control(app_key, control_name)
        if c and not exists:
            cur.execute(
                "INSERT INTO mappings(device_id, application_id, control_id, input_min, input_max, output_min, output_max, mapping_type, is_active) VALUES(?,?,?,?,?,?,?,?,?)",
                (device_id, c["application_id"], c["id"], 0, 360, c["output_min"], c["output_max"], mapping_type, 1),
            )

    # Prebuilt admin user for URL protection and user management.
    admin_hash = hashlib.sha256("admin123$".encode("utf-8")).hexdigest()
    cur.execute(
        "INSERT OR IGNORE INTO users(username, password_hash, full_name, role, status, created_at) VALUES(?,?,?,?,?,?)",
        ("admin", admin_hash, "System Administrator", "admin", "active", created),
    )

    conn.commit()
