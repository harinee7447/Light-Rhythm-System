from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional
from datetime import datetime
from backend.database import get_db, record_activity
from backend.models import RoutineCreate, RoutineUpdate, RoutineResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/api/routines", tags=["Light Routines (FR-03)"])

@router.get("", response_model=List[RoutineResponse])
def get_routines(
    q: Optional[str] = Query(None, description="Search keyword in name or description"),
    period: Optional[str] = Query(None, description="Filter by period (Morning, Day, Night)")
):
    """List light routines with optional search and period filtering."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM routines WHERE 1=1"
        params = []

        if period and period.lower() != "all":
            query += " AND LOWER(period) = LOWER(?)"
            params.append(period)

        if q:
            query += " AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))"
            search_param = f"%{q.strip()}%"
            params.extend([search_param, search_param])

        query += " ORDER BY time ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [RoutineResponse(**dict(row)) for row in rows]

@router.get("/{routine_id}", response_model=RoutineResponse)
def get_routine(routine_id: int):
    """Retrieve a single routine by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM routines WHERE id = ?", (routine_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Routine with ID {routine_id} not found.")
        return RoutineResponse(**dict(row))

@router.post("", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
def create_routine(data: RoutineCreate, current_user: dict = Depends(get_current_user)):
    """Create a new light routine (FR-03, FR-04). Protected by auth (NFR-06)."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO routines (name, period, time, brightness_pct, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.name,
            data.period,
            data.time,
            data.brightness_pct,
            data.description or "",
            1 if data.is_active else 0,
            now_iso,
            now_iso
        ))
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM routines WHERE id = ?", (new_id,))
        row = cursor.fetchone()

        record_activity(
            conn,
            event_type="ROUTINE",
            title=f"Routine created: {data.name}",
            details=f"{data.period} routine at {data.time} ({data.brightness_pct}%)",
            brightness_pct=data.brightness_pct
        )

        return RoutineResponse(**dict(row))

@router.put("/{routine_id}", response_model=RoutineResponse)
def update_routine(routine_id: int, data: RoutineUpdate, current_user: dict = Depends(get_current_user)):
    """Edit an existing light routine (FR-03). Protected by auth (NFR-06)."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM routines WHERE id = ?", (routine_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Routine with ID {routine_id} not found.")

        updated_name = data.name if data.name is not None else existing["name"]
        updated_period = data.period if data.period is not None else existing["period"]
        updated_time = data.time if data.time is not None else existing["time"]
        updated_brightness = data.brightness_pct if data.brightness_pct is not None else existing["brightness_pct"]
        updated_desc = data.description if data.description is not None else existing["description"]
        updated_active = (1 if data.is_active else 0) if data.is_active is not None else existing["is_active"]

        cursor.execute("""
            UPDATE routines
            SET name = ?, period = ?, time = ?, brightness_pct = ?, description = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        """, (updated_name, updated_period, updated_time, updated_brightness, updated_desc, updated_active, now_iso, routine_id))

        cursor.execute("SELECT * FROM routines WHERE id = ?", (routine_id,))
        row = cursor.fetchone()

        record_activity(
            conn,
            event_type="ROUTINE",
            title=f"Routine updated: {updated_name}",
            details=f"{updated_period} {updated_time} set to {updated_brightness}%",
            brightness_pct=updated_brightness
        )

        return RoutineResponse(**dict(row))

@router.delete("/{routine_id}", status_code=status.HTTP_200_OK)
def delete_routine(routine_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a light routine. Protected by auth (NFR-06)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM routines WHERE id = ?", (routine_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Routine with ID {routine_id} not found.")

        cursor.execute("DELETE FROM routines WHERE id = ?", (routine_id,))

        record_activity(
            conn,
            event_type="ROUTINE",
            title=f"Routine deleted: {existing['name']}",
            details=f"Removed routine ID {routine_id}",
            brightness_pct=existing["brightness_pct"]
        )

        return {"message": f"Routine '{existing['name']}' successfully deleted."}

@router.post("/{routine_id}/activate", status_code=status.HTTP_200_OK)
def activate_routine(routine_id: int, current_user: dict = Depends(get_current_user)):
    """Trigger/apply a routine immediately."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM routines WHERE id = ?", (routine_id,))
        routine = cursor.fetchone()
        if not routine:
            raise HTTPException(status_code=404, detail=f"Routine with ID {routine_id} not found.")

        # Set system mode to this routine's period and brightness
        period = routine["period"].capitalize()
        brightness = routine["brightness_pct"]

        cursor.execute("UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'system_mode'", (period,))
        cursor.execute("UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'override_brightness'", (str(brightness),))

        record_activity(
            conn,
            event_type="LIGHT",
            title=f"Routine applied: {routine['name']}",
            details=f"Activated {period} routine at {brightness}% by {current_user['username']}",
            brightness_pct=brightness
        )

        return {
            "message": f"Routine '{routine['name']}' activated successfully at {brightness}%.",
            "routine": dict(routine)
        }
