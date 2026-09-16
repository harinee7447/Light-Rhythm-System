import sqlite3
from contextlib import contextmanager
from datetime import datetime
from backend.config import DATABASE_PATH

def get_connection(db_path: str = None) -> sqlite3.Connection:
    path = db_path or DATABASE_PATH
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

@contextmanager
def get_db(db_path: str = None):
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db(db_path: str = None):
    with get_db(db_path) as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Schedules table (FR-01, FR-04)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            period TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            brightness_pct INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Routines table (FR-03, FR-04)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            period TEXT NOT NULL,
            time TEXT NOT NULL,
            brightness_pct INTEGER NOT NULL,
            description TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Activity History table (FR-06, FR-04)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            details TEXT DEFAULT '',
            brightness_pct INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # System Settings table (FR-04)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Seed default schedules if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM schedules")
        if cursor.fetchone()["count"] == 0:
            default_schedules = [
                ("Morning Light", "Morning", "06:00", "10:00", 60, 1),
                ("Day Light", "Day", "10:00", "18:00", 75, 1),
                ("Night Light", "Night", "18:00", "06:00", 25, 1),
            ]
            cursor.executemany("""
                INSERT INTO schedules (name, period, start_time, end_time, brightness_pct, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            """, default_schedules)

        # Seed default routines if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM routines")
        if cursor.fetchone()["count"] == 0:
            default_routines = [
                ("Morning Rhythm", "Morning", "06:00", 60, "Start the day with the scheduled morning light.", 1),
                ("Day Rhythm", "Day", "10:00", 75, "Maintain the scheduled daytime brightness.", 1),
                ("Night Rhythm", "Night", "18:00", 25, "Reduce brightness according to the night schedule.", 1),
            ]
            cursor.executemany("""
                INSERT INTO routines (name, period, time, brightness_pct, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            """, default_routines)

        # Seed initial history logs if empty
        cursor.execute("SELECT COUNT(*) as count FROM activity_history")
        if cursor.fetchone()["count"] == 0:
            now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            default_history = [
                ("LIGHT", "Day brightness activated", "Automated circadian brightness set to 75%", 75, now_iso),
                ("LIGHT", "Morning brightness activated", "Automated circadian brightness set to 60%", 60, now_iso),
                ("USER", "Night routine updated", "Routine schedule adjusted to 25%", 25, now_iso),
                ("USER", "Day routine updated", "Routine schedule adjusted to 75%", 75, now_iso),
                ("LIGHT", "Night brightness activated", "Automated circadian brightness set to 25%", 25, now_iso),
                ("LIGHT", "Morning brightness activated", "Initial rhythm initialized", 60, now_iso),
            ]
            cursor.executemany("""
                INSERT INTO activity_history (event_type, title, details, brightness_pct, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, default_history)

        # Seed initial system settings if empty
        cursor.execute("SELECT COUNT(*) as count FROM system_settings")
        if cursor.fetchone()["count"] == 0:
            cursor.execute("""
                INSERT OR REPLACE INTO system_settings (key, value)
                VALUES 
                ('system_mode', 'AUTOMATIC'),
                ('override_brightness', '-1'),
                ('auto_adjust_enabled', '1')
            """)

def record_activity(conn: sqlite3.Connection, event_type: str, title: str, details: str = "", brightness_pct: int = None):
    """Helper to record system and user events in the activity history table (FR-06)."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("""
        INSERT INTO activity_history (event_type, title, details, brightness_pct, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (event_type.upper(), title, details, brightness_pct, now_iso))
