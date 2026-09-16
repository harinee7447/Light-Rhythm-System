import io
import csv
import os
from fastapi import APIRouter, Response, Query
from datetime import datetime
from backend.database import get_db
from backend.models import ReportSummaryResponse
from backend.config import DATABASE_PATH

router = APIRouter(prefix="/api/reports", tags=["Reports & Storage"])

@router.get("/summary", response_model=ReportSummaryResponse)
def get_report_summary():
    """Generate rhythm adherence and schedule statistics report."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as count, AVG(brightness_pct) as avg_bright FROM schedules")
        sch_res = cursor.fetchone()
        total_schedules = sch_res["count"] or 0
        avg_brightness = round(float(sch_res["avg_bright"] or 0), 1)

        cursor.execute("SELECT COUNT(*) as count FROM routines")
        total_routines = cursor.fetchone()["count"] or 0

        cursor.execute("SELECT COUNT(*) as count FROM routines WHERE is_active = 1")
        active_routines = cursor.fetchone()["count"] or 0

        cursor.execute("SELECT COUNT(*) as count FROM activity_history")
        total_history = cursor.fetchone()["count"] or 0

        # Adherence percentage calculation based on active schedules vs target 3 periods
        adherence = min(100.0, round((total_schedules / 3.0) * 100.0, 1)) if total_schedules else 0.0

        return ReportSummaryResponse(
            total_schedules=total_schedules,
            total_routines=total_routines,
            total_history_records=total_history,
            avg_brightness=avg_brightness,
            active_routines=active_routines,
            adherence_pct=adherence,
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

@router.get("/storage")
def get_storage_metrics():
    """Retrieve SQLite database status and metrics (FR-04)."""
    db_size = os.path.getsize(DATABASE_PATH) if os.path.exists(DATABASE_PATH) else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [r["name"] for r in cursor.fetchall()]

        table_counts = {}
        for t in tables:
            cursor.execute(f"SELECT COUNT(*) as count FROM {t}")
            table_counts[t] = cursor.fetchone()["count"]

        # Run quick integrity check
        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]

    return {
        "database_engine": "SQLite 3",
        "database_path": DATABASE_PATH,
        "database_size_bytes": db_size,
        "database_size_formatted": f"{round(db_size / 1024, 2)} KB",
        "tables": tables,
        "record_counts": table_counts,
        "integrity": integrity,
        "status": "Online and Operational"
    }

@router.get("/export.csv")
def export_csv_report(type: str = Query("schedules", description="Export type: schedules, routines, or history")):
    """Export data in CSV format for audit reporting."""
    output = io.StringIO()
    writer = csv.writer(output)

    with get_db() as conn:
        cursor = conn.cursor()

        if type == "history":
            cursor.execute("SELECT id, event_type, title, details, brightness_pct, timestamp FROM activity_history ORDER BY timestamp DESC")
            rows = cursor.fetchall()
            writer.writerow(["ID", "Event Type", "Title", "Details", "Brightness %", "Timestamp"])
            for r in rows:
                writer.writerow([r["id"], r["event_type"], r["title"], r["details"], r["brightness_pct"] or "", r["timestamp"]])
            filename = f"light_rhythm_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        elif type == "routines":
            cursor.execute("SELECT id, name, period, time, brightness_pct, description, is_active FROM routines ORDER BY time ASC")
            rows = cursor.fetchall()
            writer.writerow(["ID", "Routine Name", "Period", "Time", "Brightness %", "Description", "Active"])
            for r in rows:
                writer.writerow([r["id"], r["name"], r["period"], r["time"], r["brightness_pct"], r["description"], "Yes" if r["is_active"] else "No"])
            filename = f"light_rhythm_routines_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        else: # schedules
            cursor.execute("SELECT id, name, period, start_time, end_time, brightness_pct, is_active FROM schedules ORDER BY start_time ASC")
            rows = cursor.fetchall()
            writer.writerow(["ID", "Schedule Name", "Period", "Start Time", "End Time", "Brightness %", "Active"])
            for r in rows:
                writer.writerow([r["id"], r["name"], r["period"], r["start_time"], r["end_time"], r["brightness_pct"], "Yes" if r["is_active"] else "No"])
            filename = f"light_rhythm_schedules_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
