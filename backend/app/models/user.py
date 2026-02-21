from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)

    # Strava integration
    strava_access_token = Column(String(255), nullable=True)
    strava_refresh_token = Column(String(255), nullable=True)
    strava_athlete_id = Column(Integer, nullable=True, unique=True)
    strava_token_expires_at = Column(DateTime, nullable=True)

    # AI-generated profile summary based on activity history
    # Updated after each Strava sync to provide context for recommendations
    profile_summary = Column(Text, nullable=True)

    # User preferences (JSON with hr_zones, pace_zones, units, etc.)
    preferences = Column(JSON, default={
        "units": "metric",
        "hr_zones": {
            "zone1": {"min": 0, "max": 130, "name": "Recovery"},
            "zone2": {"min": 130, "max": 150, "name": "Aerobic"},
            "zone3": {"min": 150, "max": 165, "name": "Tempo"},
            "zone4": {"min": 165, "max": 180, "name": "Threshold"},
            "zone5": {"min": 180, "max": 220, "name": "VO2max"}
        },
        "pace_zones": {
            "easy": {"min": 330, "max": 390, "name": "Easy"},  # seconds per km
            "moderate": {"min": 300, "max": 330, "name": "Moderate"},
            "tempo": {"min": 270, "max": 300, "name": "Tempo"},
            "threshold": {"min": 250, "max": 270, "name": "Threshold"},
            "interval": {"min": 210, "max": 250, "name": "Interval"}
        },
        "max_hr": 190,
        "resting_hr": 50
    })

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    competitions = relationship("Competition", back_populates="user", cascade="all, delete-orphan")
    training_sessions = relationship("TrainingSession", back_populates="user", cascade="all, delete-orphan")
    uploaded_plans = relationship("UploadedPlan", back_populates="user", cascade="all, delete-orphan")
    zone_history = relationship("ZoneHistory", back_populates="user", cascade="all, delete-orphan", order_by="desc(ZoneHistory.calculated_at)")
