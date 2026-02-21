from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Enum as SQLEnum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class RaceType(str, enum.Enum):
    FIVE_K = "5K"
    TEN_K = "10K"
    HALF_MARATHON = "HM"
    MARATHON = "M"
    ULTRA_50K = "50K"
    ULTRA_100K = "100K"
    ULTRA_50M = "50M"
    ULTRA_100M = "100M"
    OTHER = "OTHER"


class RacePriority(str, enum.Enum):
    A = "A"  # Main goal race
    B = "B"  # Important race
    C = "C"  # Training race / low priority


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    race_type = Column(SQLEnum(RaceType), nullable=False)
    distance = Column(Float, nullable=True)  # meters (for custom distances)
    elevation_gain = Column(Float, nullable=True)  # meters

    race_date = Column(Date, nullable=False, index=True)
    location = Column(String(255), nullable=True)

    # Goals
    goal_time = Column(Integer, nullable=True)  # seconds
    goal_pace = Column(Float, nullable=True)  # seconds per km
    priority = Column(SQLEnum(RacePriority), default=RacePriority.B)

    notes = Column(String(2000), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="competitions")
