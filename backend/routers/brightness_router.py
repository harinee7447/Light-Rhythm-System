from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import Optional
from backend.database import get_db, record_activity
from backend.models import BrightnessStateResponse, ModeSelectRequest
from backend.auth import get_current_user

router = APIRouter(prefix="/api/brightness", tags=["Brightness Rhythm (FR-02)"])

def determine_circadian_mode(current_hour: int, current_minute: int):
    """
    Determine default circadian mode and brightness based on system time (FR-02):
    - Morning (06:00 - 10:00): 60%
    - Day (10:00 - 18:00): 75%
    - Night (18:00 - 06:00): 25%
    """
    total_minutes = current_hour * 60 + current_minute
    morning_start = 6 * 60
    day_start = 10 * 60
    night_start = 18 * 60

    if morning_start <= total_minutes < day_start:
        return "Morning", 60, "☼", "Morning light is active", "MORNING"
    elif day_start <= total_minutes < night_start:
        return "Day", 75, "☀", "Bright daytime lighting", "DAY"
    else:
        return "Night", 25, "☾", "Night lighting is active", "NIGHT"

@router.get("/current", response_model=BrightnessStateResponse)
def get_current_brightness():
    """
    Get the active light brightness and mode.
    Automatically calculated from active schedules or circadian time bands (FR-02, FR-05).
    """
    now = datetime.now()
    now_str = now.strftime("%H:%M:%S")
    current_time_hm = now.strftime("%H:%M")
    hour, minute = now.hour, now.minute

    default_mode, default_pct, symbol, description, period_label = determine_circadian_mode(hour, minute)

    with get_db() as conn:
        cursor = conn.cursor()

        # Check for manual system mode override
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        mode_row = cursor.fetchone()
        system_mode = mode_row["value"] if mode_row else "AUTOMATIC"

        cursor.execute("SELECT value FROM system_settings WHERE key = 'override_brightness'")
        override_row = cursor.fetchone()
        override_val = int(override_row["value"]) if override_row and override_row["value"] != "-1" else None

        active_schedule_name = None

        if system_mode != "AUTOMATIC" and override_val is not None:
            # Manual mode active
            mode_symbol_map = {"Morning": "☼", "Day": "☀", "Night": "☾"}
            return BrightnessStateResponse(
                current_mode=system_mode,
                brightness_pct=override_val,
                period=system_mode.upper(),
                symbol=mode_symbol_map.get(system_mode, "☼"),
                description=f"Manual {system_mode} lighting override active",
                is_automatic=False,
                current_time=now_str,
                active_schedule_name="Manual Override"
            )

        # Check if an active schedule matches the current time
        cursor.execute("""
            SELECT name, period, brightness_pct, start_time, end_time 
            FROM schedules 
            WHERE is_active = 1
            ORDER BY start_time ASC
        """)
        schedules = cursor.fetchall()

        matched_schedule = None
        for sch in schedules:
            start = sch["start_time"]
            end = sch["end_time"]
            if start <= end:
                if start <= current_time_hm < end:
                    matched_schedule = sch
                    break
            else: # Overnight schedule (e.g., 18:00 to 06:00)
                if current_time_hm >= start or current_time_hm < end:
                    matched_schedule = sch
                    break

        if matched_schedule:
            mode_name = matched_schedule["period"].capitalize()
            brightness = matched_schedule["brightness_pct"]
            active_schedule_name = matched_schedule["name"]
            mode_symbol_map = {"Morning": "☼", "Day": "☀", "Night": "☾"}
            return BrightnessStateResponse(
                current_mode=mode_name,
                brightness_pct=brightness,
                period=mode_name.upper(),
                symbol=mode_symbol_map.get(mode_name, "☼"),
                description=f"Following schedule: {active_schedule_name}",
                is_automatic=True,
                current_time=now_str,
                active_schedule_name=active_schedule_name
            )

        # Fallback to default circadian thresholds
        return BrightnessStateResponse(
            current_mode=default_mode,
            brightness_pct=default_pct,
            period=period_label,
            symbol=symbol,
            description=description,
            is_automatic=True,
            current_time=now_str,
            active_schedule_name=f"Standard {default_mode} Rhythm"
        )

@router.post("/mode", status_code=status.HTTP_200_OK)
def set_manual_mode(req: ModeSelectRequest, current_user: dict = Depends(get_current_user)):
    """Set manual brightness mode or trigger quick mode override (Protected by auth)."""
    mode = req.mode.capitalize()
    if mode not in ["Morning", "Day", "Night"]:
        raise HTTPException(status_code=400, detail="Mode must be Morning, Day, or Night.")

    default_values = {"Morning": 60, "Day": 75, "Night": 25}
    brightness = req.brightness_pct if req.brightness_pct is not None else default_values[mode]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'system_mode'", (mode,))
        cursor.execute("UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'override_brightness'", (str(brightness),))

        record_activity(
            conn,
            event_type="LIGHT",
            title=f"{mode} mode manually activated",
            details=f"Brightness set to {brightness}% by {current_user['username']}",
            brightness_pct=brightness
        )

    return {"message": f"{mode} mode activated at {brightness}%.", "mode": mode, "brightness_pct": brightness}

@router.post("/reset", status_code=status.HTTP_200_OK)
def reset_to_automatic(current_user: dict = Depends(get_current_user)):
    """Reset brightness control back to automatic circadian schedule."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE system_settings SET value = 'AUTOMATIC', updated_at = CURRENT_TIMESTAMP WHERE key = 'system_mode'")
        cursor.execute("UPDATE system_settings SET value = '-1', updated_at = CURRENT_TIMESTAMP WHERE key = 'override_brightness'")

        record_activity(
            conn,
            event_type="LIGHT",
            title="Automatic rhythm restored",
            details=f"Circadian scheduler re-enabled by {current_user['username']}"
        )

    return {"message": "System restored to automatic circadian rhythm."}
