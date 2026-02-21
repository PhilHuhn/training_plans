from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strava_id = Column(String(50), unique=True, nullable=True, index=True)

    # Basic info
    name = Column(String(255), nullable=False)
    activity_type = Column(String(50), nullable=False)  # Run, Trail Run, etc.
    description = Column(String(1000), nullable=True)

    # Strava workout classification
    # workout_type: For runs: 0=default, 1=race, 2=long run, 3=workout
    # For rides: 10=default, 11=race, 12=workout
    workout_type = Column(Integer, nullable=True)
    is_commute = Column(Integer, nullable=True)  # 1 if commute, 0 otherwise

    # Metrics
    distance = Column(Float, nullable=True)  # meters
    duration = Column(Integer, nullable=True)  # seconds
    elevation_gain = Column(Float, nullable=True)  # meters
    calories = Column(Integer, nullable=True)

    # Heart rate
    avg_heart_rate = Column(Float, nullable=True)
    max_heart_rate = Column(Float, nullable=True)

    # Pace (calculated from distance/duration)
    avg_pace = Column(Float, nullable=True)  # seconds per km

    # Timing
    start_date = Column(DateTime, nullable=False, index=True)
    start_date_local = Column(DateTime, nullable=True)

    # Store raw Strava data for future use
    raw_data = Column(JSON, nullable=True)

    # Detailed lap/split data from Strava API (fetched separately)
    laps_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="activities")
    completed_session = relationship("TrainingSession", back_populates="completed_activity", uselist=False)
