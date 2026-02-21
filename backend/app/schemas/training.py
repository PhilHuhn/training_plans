from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime
from enum import Enum
from app.models.training_session import SessionSource, SessionStatus


class StepType(str, Enum):
    """Types of workout steps"""
    WARMUP = "warmup"
    ACTIVE = "active"
    RECOVERY = "recovery"
    REST = "rest"
    COOLDOWN = "cooldown"
    REPEAT = "repeat"  # Container for interval repetitions


class TargetType(str, Enum):
    """What to target during a step"""
    OPEN = "open"  # No specific target
    PACE = "pace"
    HEART_RATE = "heart_rate"
    HEART_RATE_ZONE = "heart_rate_zone"
    CADENCE = "cadence"


class DurationType(str, Enum):
    """How step duration is measured"""
    TIME = "time"  # Duration in seconds
    DISTANCE = "distance"  # Distance in meters
    LAP_BUTTON = "lap_button"  # Manual lap press
    OPEN = "open"  # Until user decides


class WorkoutStep(BaseModel):
    """A single step within a structured workout"""
    step_type: StepType
    name: Optional[str] = None  # e.g., "400m repeats"

    # Duration
    duration_type: DurationType = DurationType.OPEN
    duration_value: Optional[float] = None  # seconds or meters depending on type

    # Target
    target_type: TargetType = TargetType.OPEN
    target_value_low: Optional[float] = None  # e.g., pace in sec/km or HR
    target_value_high: Optional[float] = None
    target_zone: Optional[int] = None  # 1-5 for HR zones

    # For repeat steps
    repeat_count: Optional[int] = None  # Number of repetitions
    repeat_steps: Optional[list["WorkoutStep"]] = None  # Steps to repeat

    notes: Optional[str] = None


class StructuredWorkout(BaseModel):
    """A fully structured workout with steps for Garmin/Suunto export"""
    name: str
    sport: Literal["running", "cycling", "swimming", "strength", "hiking", "rowing", "other"] = "running"
    description: Optional[str] = None
    steps: list[WorkoutStep]

    # Summary fields (calculated or provided)
    estimated_duration_min: Optional[int] = None
    estimated_distance_km: Optional[float] = None


class WorkoutDetails(BaseModel):
    """Structure for both planned and recommended workouts"""
    type: str  # easy, tempo, interval, long_run, recovery, rest, cross_training
    sport: Optional[str] = "running"  # running, cycling, swimming, strength, hiking, rowing, other
    description: str
    power_target_watts: Optional[int] = None  # For cycling with FTP
    distance_km: Optional[float] = None
    duration_min: Optional[int] = None
    intensity: Optional[str] = None  # low, moderate, high
    hr_zone: Optional[str] = None  # zone1-zone5
    pace_range: Optional[str] = None  # e.g., "5:00-5:30"
    intervals: Optional[list[dict]] = None  # For interval sessions
    notes: Optional[str] = None

    # Enhanced structured workout for Garmin/Suunto export
    structured: Optional[StructuredWorkout] = None


class TrainingSessionBase(BaseModel):
    session_date: date
    planned_workout: Optional[WorkoutDetails] = None
    recommendation_workout: Optional[WorkoutDetails] = None
    notes: Optional[str] = None


class TrainingSessionCreate(TrainingSessionBase):
    source: SessionSource = SessionSource.MANUAL


class TrainingSessionUpdate(BaseModel):
    planned_workout: Optional[WorkoutDetails] = None
    recommendation_workout: Optional[WorkoutDetails] = None
    status: Optional[SessionStatus] = None
    notes: Optional[str] = None


class TrainingSessionResponse(TrainingSessionBase):
    id: int
    source: SessionSource
    status: SessionStatus
    completed_activity_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrainingWeekResponse(BaseModel):
    """Response for a week of training sessions"""
    sessions: list[TrainingSessionResponse]
    week_start: date
    week_end: date
    total_distance_planned: float
    total_distance_recommended: float


class GenerateRecommendationsRequest(BaseModel):
    """Request to generate AI recommendations"""
    start_date: date
    end_date: date
    consider_uploaded_plan: bool = True


class ConvertSessionRequest(BaseModel):
    """Request to convert a session from pace-based to HR-based or vice versa"""
    workout: WorkoutDetails
    target_type: str  # "hr_based" or "pace_based"


class UploadPlanResponse(BaseModel):
    id: int
    filename: str
    is_active: bool
    parsed_sessions_count: int
    upload_date: datetime

    class Config:
        from_attributes = True
