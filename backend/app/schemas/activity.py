from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActivityBase(BaseModel):
    name: str
    activity_type: str
    description: Optional[str] = None


class ActivityCreate(ActivityBase):
    distance: Optional[float] = None
    duration: Optional[int] = None
    elevation_gain: Optional[float] = None
    avg_heart_rate: Optional[float] = None
    max_heart_rate: Optional[float] = None
    start_date: datetime


class ActivityResponse(ActivityBase):
    id: int
    strava_id: Optional[str] = None
    distance: Optional[float] = None
    duration: Optional[int] = None
    elevation_gain: Optional[float] = None
    calories: Optional[int] = None
    avg_heart_rate: Optional[float] = None
    max_heart_rate: Optional[float] = None
    avg_pace: Optional[float] = None
    start_date: datetime
    start_date_local: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActivityListResponse(BaseModel):
    activities: list[ActivityResponse]
    total: int
    page: int
    per_page: int
