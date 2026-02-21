from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.models.competition import RaceType, RacePriority


class CompetitionBase(BaseModel):
    name: str
    race_type: RaceType
    race_date: date
    distance: Optional[float] = None
    elevation_gain: Optional[float] = None
    location: Optional[str] = None
    goal_time: Optional[int] = None
    goal_pace: Optional[float] = None
    priority: RacePriority = RacePriority.B
    notes: Optional[str] = None


class CompetitionCreate(CompetitionBase):
    pass


class CompetitionUpdate(BaseModel):
    name: Optional[str] = None
    race_type: Optional[RaceType] = None
    race_date: Optional[date] = None
    distance: Optional[float] = None
    elevation_gain: Optional[float] = None
    location: Optional[str] = None
    goal_time: Optional[int] = None
    goal_pace: Optional[float] = None
    priority: Optional[RacePriority] = None
    notes: Optional[str] = None


class CompetitionResponse(CompetitionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    days_until: Optional[int] = None

    class Config:
        from_attributes = True
