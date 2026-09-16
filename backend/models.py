from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import re

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

# --- Auth Models ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    password: str = Field(..., min_length=6, max_length=100, description="Password (min 6 characters)")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain alphanumeric characters, underscores, and hyphens.")
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Schedule Models (FR-01) ---
class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    period: str = Field(..., description="Morning, Day, or Night")
    start_time: str = Field(..., description="Time in HH:MM format (24h)")
    end_time: str = Field(..., description="Time in HH:MM format (24h)")
    brightness_pct: int = Field(..., ge=0, le=100, description="Brightness percentage 0-100")
    is_active: bool = True

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (00:00 to 23:59)")
        return v

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        clean = v.capitalize()
        if clean not in ["Morning", "Day", "Night"]:
            raise ValueError("Period must be Morning, Day, or Night")
        return clean

class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    period: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    brightness_pct: Optional[int] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (00:00 to 23:59)")
        return v

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.capitalize()
            if clean not in ["Morning", "Day", "Night"]:
                raise ValueError("Period must be Morning, Day, or Night")
            return clean
        return v

class ScheduleResponse(BaseModel):
    id: int
    name: str
    period: str
    start_time: str
    end_time: str
    brightness_pct: int
    is_active: bool
    created_at: str
    updated_at: str

# --- Routine Models (FR-03) ---
class RoutineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    period: str = Field(..., description="Morning, Day, or Night")
    time: str = Field(..., description="Time in HH:MM format (24h)")
    brightness_pct: int = Field(..., ge=0, le=100)
    description: str = Field("", max_length=500)
    is_active: bool = True

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (00:00 to 23:59)")
        return v

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        clean = v.capitalize()
        if clean not in ["Morning", "Day", "Night"]:
            raise ValueError("Period must be Morning, Day, or Night")
        return clean

class RoutineUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    period: Optional[str] = None
    time: Optional[str] = None
    brightness_pct: Optional[int] = Field(None, ge=0, le=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (00:00 to 23:59)")
        return v

    @field_validator("period")
    @classmethod
    def validate_period(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.capitalize()
            if clean not in ["Morning", "Day", "Night"]:
                raise ValueError("Period must be Morning, Day, or Night")
            return clean
        return v

class RoutineResponse(BaseModel):
    id: int
    name: str
    period: str
    time: str
    brightness_pct: int
    description: str
    is_active: bool
    created_at: str
    updated_at: str

# --- Brightness & State Models (FR-02, FR-05) ---
class BrightnessStateResponse(BaseModel):
    current_mode: str
    brightness_pct: int
    period: str
    symbol: str
    description: str
    is_automatic: bool
    current_time: str
    active_schedule_name: Optional[str] = None

class ModeSelectRequest(BaseModel):
    mode: str = Field(..., description="Morning, Day, or Night")
    brightness_pct: Optional[int] = Field(None, ge=0, le=100)

# --- History Models (FR-06) ---
class HistoryItemResponse(BaseModel):
    id: int
    event_type: str
    title: str
    details: str
    brightness_pct: Optional[int]
    timestamp: str

# --- Reports & Dashboard Models ---
class DashboardResponse(BaseModel):
    current_mode: str
    brightness_pct: int
    symbol: str
    greeting: str
    day_period: str
    current_time: str
    today_date: str
    schedules: List[ScheduleResponse]
    recent_history: List[HistoryItemResponse]
    stats: dict

class ReportSummaryResponse(BaseModel):
    total_schedules: int
    total_routines: int
    total_history_records: int
    avg_brightness: float
    active_routines: int
    adherence_pct: float
    generated_at: str
