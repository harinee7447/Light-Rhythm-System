from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from backend.database import get_db, record_activity
from backend.models import HistoryItemResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["Activity History (FR-06)"])

@router.get("", response_model=List[HistoryItemResponse])
def get_history(
    event_type: Optional[str] = Query(None, description="Filter by event type (LIGHT, USER, SCHEDULE, ROUTINE)"),
    q: Optional[str] = Query(None, description="Search keyword in title or details"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """Retrieve recorded history of light changes and user activity (FR-06)."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM activity_history WHERE 1=1"
        params = []

        if event_type and event_type.lower() != "all":
            query += " AND UPPER(event_type) = UPPER(?)"
            params.append(event_type)

        if q:
            query += " AND (LOWER(title) LIKE LOWER(?) OR LOWER(details) LIKE LOWER(?))"
            search_param = f"%{q.strip()}%"
            params.extend([search_param, search_param])

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [HistoryItemResponse(**dict(row)) for row in rows]

@router.post("/clear", status_code=status.HTTP_200_OK)
def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear activity history (Protected by auth)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM activity_history")
        record_activity(
            conn,
            event_type="USER",
            title="Activity history cleared",
            details=f"Logs cleared by {current_user['username']}"
        )
    return {"message": "Activity history cleared."}
