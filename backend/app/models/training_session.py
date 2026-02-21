from sqlalchemy import Column, Integer, String, Date, DateTime, JSON, Enum as SQLEnum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SessionSource(str, enum.Enum):
    APP_RECOMMENDATION = "app_recommendation"
    UPLOADED_PLAN = "uploaded_plan"
    MANUAL = "manual"


class SessionStatus(str, enum.Enum):
    PLANNED = "planned"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    MODIFIED = "modified"


class AcceptedSource(str, enum.Enum):
    NONE = "none"
    PLANNED = "planned"
    AI = "ai"


class TrainingSession(Base):
    """
    Represents a training session that can have both a fixed/planned workout
    (from user or uploaded plan) and an AI recommendation side by side.
    """
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_date = Column(Date, nullable=False, index=True)

    source = Column(SQLEnum(SessionSource), default=SessionSource.APP_RECOMMENDATION)
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.PLANNED)

    # Left column: Fixed/planned workout (from uploaded plan or manual entry)
    # Structure: {type, description, distance_km, duration_min, intensity, hr_zone, pace_range, notes}
    planned_workout = Column(JSON, nullable=True)

    # Middle column: AI recommendation
    # Same structure as planned_workout
    recommendation_workout = Column(JSON, nullable=True)

    # Right column: Final workout (accepted from either planned or AI)
    # Tracks which source was accepted for the final plan
    # Using String instead of Enum to avoid case-sensitivity issues with PostgreSQL
    accepted_source = Column(String(20), default="none")
    final_workout = Column(JSON, nullable=True)

    # Link to completed activity (if the session was done)
    completed_activity_id = Column(Integer, ForeignKey("activities.id"), nullable=True)

    # Link to uploaded plan (if source is uploaded_plan)
    uploaded_plan_id = Column(Integer, ForeignKey("uploaded_plans.id"), nullable=True)

    notes = Column(String(2000), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="training_sessions")
    completed_activity = relationship("Activity", back_populates="completed_session")
    uploaded_plan = relationship("UploadedPlan", back_populates="sessions")


class UploadedPlan(Base):
    """
    Represents an uploaded training plan document (PDF, Word, etc.)
    that has been parsed into individual sessions.
    """
    __tablename__ = "uploaded_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=True)

    # Extracted text from the document
    content_text = Column(String, nullable=True)

    # Parsed sessions as JSON array
    parsed_sessions = Column(JSON, nullable=True)

    # Whether this plan is currently active (overrides AI recommendations)
    is_active = Column(Integer, default=1)  # Using Integer for SQLite compatibility

    upload_date = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="uploaded_plans")
    sessions = relationship("TrainingSession", back_populates="uploaded_plan")
