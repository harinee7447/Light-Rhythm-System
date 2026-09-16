from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional
from datetime import datetime
from backend.database import get_db, record_activity
from backend.models import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/api/schedules", tags=["Daily Schedules (FR-01)"])

@router.get("", response_model=List[ScheduleResponse])
def get_schedules(
    q: Optional[str] = Query(None, description="Search keyword in name or period"),
    period: Optional[str] = Query(None, description="Filter by period (Morning, Day, Night)")
):
    """Retrieve daily schedules with optional search and period filtering."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM schedules WHERE 1=1"
        params = []

        if period and period.lower() != "all":
            query += " AND LOWER(period) = LOWER(?)"
            params.append(period)

        if q:
            query += " AND (LOWER(name) LIKE LOWER(?) OR LOWER(period) LIKE LOWER(?))"
            search_param = f"%{q.strip()}%"
            params.extend([search_param, search_param])

        query += " ORDER BY start_time ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [ScheduleResponse(**dict(row)) for row in rows]

@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(schedule_id: int):
    """Get a single schedule by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Schedule with ID {schedule_id} not found.")
        return ScheduleResponse(**dict(row))

@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(data: ScheduleCreate, current_user: dict = Depends(get_current_user)):
    """Create a new daily light schedule (FR-01, FR-04). Protected by auth (NFR-06)."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO schedules (name, period, start_time, end_time, brightness_pct, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.name,
            data.period,
            data.start_time,
            data.end_time,
            data.brightness_pct,
            1 if data.is_active else 0,
            now_iso,
            now_iso
        ))
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM schedules WHERE id = ?", (new_id,))
        row = cursor.fetchone()

        record_activity(
            conn,
            event_type="SCHEDULE",
            title=f"Schedule created: {data.name}",
            details=f"Period: {data.period}, {data.start_time} - {data.end_time} @ {data.brightness_pct}%",
            brightness_pct=data.brightness_pct
        )

        return ScheduleResponse(**dict(row))

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: int, data: ScheduleUpdate, current_user: dict = Depends(get_current_user)):
    """Update an existing light schedule. Protected by auth (NFR-06)."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Schedule with ID {schedule_id} not found.")

        updated_name = data.name if data.name is not None else existing["name"]
        updated_period = data.period if data.period is not None else existing["period"]
        updated_start = data.start_time if data.start_time is not None else existing["start_time"]
        updated_end = data.end_time if data.end_time is not None else existing["end_time"]
        updated_brightness = data.brightness_pct if data.brightness_pct is not None else existing["brightness_pct"]
        updated_active = (1 if data.is_active else 0) if data.is_active is not None else existing["is_active"]

        cursor.execute("""
            UPDATE schedules
            SET name = ?, period = ?, start_time = ?, end_time = ?, brightness_pct = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        """, (updated_name, updated_period, updated_start, updated_end, updated_brightness, updated_active, now_iso, schedule_id))

        cursor.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        row = cursor.fetchone()

        record_activity(
            conn,
            event_type="SCHEDULE",
            title=f"Schedule updated: {updated_name}",
            details=f"{updated_period} {updated_start}-{updated_end} set to {updated_brightness}%",
            brightness_pct=updated_brightness
        )

        return ScheduleResponse(**dict(row))

@router.delete("/{schedule_id}", status_code=status.HTTP_200_OK)
def delete_schedule(schedule_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a daily light schedule. Protected by auth (NFR-06)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Schedule with ID {schedule_id} not found.")

        cursor.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))

        record_activity(
            conn,
            event_type="SCHEDULE",
            title=f"Schedule deleted: {existing['name']}",
            details=f"Removed schedule ID {schedule_id}",
            brightness_pct=existing["brightness_pct"]
        )

        return {"message": f"Schedule '{existing['name']}' successfully deleted."}
