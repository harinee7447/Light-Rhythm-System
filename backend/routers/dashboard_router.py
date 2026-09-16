from fastapi import APIRouter
from datetime import datetime
from backend.database import get_db
from backend.models import DashboardResponse, ScheduleResponse, HistoryItemResponse
from backend.routers.brightness_router import get_current_brightness

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard (FR-05)"])

@router.get("", response_model=DashboardResponse)
def get_dashboard_data():
    """
    Returns unified real-time dashboard data in < 2 seconds (NFR-01).
    Displays current light mode, brightness, schedules, and recent activity (FR-05).
    """
    now = datetime.now()
    brightness_state = get_current_brightness()

    hour = now.hour
    if 5 <= hour < 12:
        greeting = "morning"
    elif 12 <= hour < 17:
        greeting = "day"
    elif 17 <= hour < 21:
        greeting = "evening"
    else:
        greeting = "night"

    formatted_time = now.strftime("%H:%M:%S")
    today_date = now.strftime("%A, %B %d, %Y")

    with get_db() as conn:
        cursor = conn.cursor()

        # Fetch schedules
        cursor.execute("SELECT * FROM schedules WHERE is_active = 1 ORDER BY start_time ASC")
        schedule_rows = cursor.fetchall()
        schedules = [ScheduleResponse(**dict(r)) for r in schedule_rows]

        # Fetch recent 6 activity records
        cursor.execute("SELECT * FROM activity_history ORDER BY timestamp DESC LIMIT 6")
        history_rows = cursor.fetchall()
        recent_history = [HistoryItemResponse(**dict(r)) for r in history_rows]

        # Fetch counts
        cursor.execute("SELECT COUNT(*) as count FROM schedules")
        schedules_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM routines")
        routines_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM activity_history")
        history_count = cursor.fetchone()["count"]

        stats = {
            "schedules_count": schedules_count,
            "routines_count": routines_count,
            "history_count": history_count,
            "morning_level": 60,
            "day_level": 75,
            "night_level": 25,
        }

    return DashboardResponse(
        current_mode=brightness_state.current_mode,
        brightness_pct=brightness_state.brightness_pct,
        symbol=brightness_state.symbol,
        greeting=greeting,
        day_period=brightness_state.period,
        current_time=formatted_time,
        today_date=today_date,
        schedules=schedules,
        recent_history=recent_history,
        stats=stats
    )
