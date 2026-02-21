from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ZoneHistory(Base):
    """Track historical zone calculations for evolution analysis"""
    __tablename__ = "zone_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamp of when zones were calculated/saved
    calculated_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Source of data used for calculation
    source = Column(String(50), nullable=False)  # 'strava_estimate', 'manual', 'imported'

    # Number of activities used for estimation (if from Strava)
    activities_analyzed = Column(Integer, nullable=True)
    date_range_start = Column(DateTime, nullable=True)
    date_range_end = Column(DateTime, nullable=True)

    # Heart rate data
    max_hr = Column(Integer, nullable=True)
    resting_hr = Column(Integer, nullable=True)
    hr_zones = Column(JSON, nullable=True)
    # Example: {"zone1": {"min": 100, "max": 130}, "zone2": {...}, ...}

    # Pace data (seconds per km)
    threshold_pace = Column(Float, nullable=True)  # seconds per km
    pace_zones = Column(JSON, nullable=True)
    # Example: {"zone1": {"min": 360, "max": 420}, "zone2": {...}, ...}

    # Cycling power data
    ftp = Column(Integer, nullable=True)
    cycling_power_zones = Column(JSON, nullable=True)

    # Additional metrics from analysis
    avg_hr_easy_runs = Column(Float, nullable=True)
    avg_hr_tempo_runs = Column(Float, nullable=True)
    avg_pace_easy_runs = Column(Float, nullable=True)  # seconds per km
    avg_pace_tempo_runs = Column(Float, nullable=True)

    # Notes about calculation
    notes = Column(String(500), nullable=True)

    # Relationship
    user = relationship("User", back_populates="zone_history")
