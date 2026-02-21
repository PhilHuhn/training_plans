from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserPreferences(BaseModel):
    units: str = "metric"
    hr_zones: dict = {}
    pace_zones: dict = {}
    max_hr: int = 190
    resting_hr: int = 50


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    preferences: Optional[UserPreferences] = None


class UserResponse(UserBase):
    id: int
    preferences: dict
    strava_connected: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
