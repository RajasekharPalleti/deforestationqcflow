import hashlib
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "validation.db"
DB_PATH.parent.mkdir(exist_ok=True)

_local = threading.local()


def get_db() -> sqlite3.Connection:
    """One connection per thread — FastAPI/uvicorn may serve requests on different threads."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA busy_timeout=10000")
        _local.conn = conn
    return conn


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def log_action(conn, tenant, project, model_name, plot_id, username, action, details=""):
    """Write to activity log using the caller's existing connection. Caller commits."""
    conn.execute(
        "INSERT INTO activity_log (tenant,project,model_name,plot_id,username,action,details)"
        " VALUES (?,?,?,?,?,?,?)",
        (tenant, project, model_name, plot_id, username, action, details))


def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        username      TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL,
        display_name  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plots (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant           TEXT NOT NULL,
        project          TEXT NOT NULL,
        model_name       TEXT NOT NULL,
        plot_id          TEXT NOT NULL,
        farmer_id        TEXT,
        farmer_name      TEXT,
        lat              REAL,
        lon              REAL,
        detection_status TEXT,
        pipeline_flag    TEXT DEFAULT 'Clean',
        publish_status   TEXT DEFAULT 'unpublished',
        model_data       TEXT,
        evidence_url     TEXT,
        qa_status        TEXT DEFAULT 'Pending',
        qa_reason        TEXT,
        qa_comments      TEXT,
        qa_user          TEXT,
        qa_at            TEXT,
        ds_status        TEXT DEFAULT 'Pending',
        ds_comments      TEXT,
        ds_user          TEXT,
        ds_at            TEXT,
        final_status     TEXT,
        published_at     TEXT,
        published_by     TEXT,
        synced_at        TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant, project, model_name, plot_id)
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant     TEXT,
        project    TEXT,
        model_name TEXT,
        plot_id    TEXT,
        username   TEXT,
        action     TEXT,
        details    TEXT,
        ts         TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        for u, p, r, d in [
            ("harsha", "harsha123", "PM", "Harsha (PM)"),
            ("qa1", "qa123", "QA", "Priya (QA)"),
            ("qa2", "qa123", "QA", "Ravi (QA)"),
            ("ds1", "ds123", "DS", "Aditya (DS)"),
        ]:
            conn.execute("INSERT INTO users VALUES (?,?,?,?)", (u, hash_password(p), r, d))
    conn.commit()
