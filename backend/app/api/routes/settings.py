from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.activity import Activity
from app.api.deps import get_current_user
from app.services.zone_estimator import (
    estimate_zones_from_strava,
    save_zones_to_history,
    apply_zones_to_user,
    get_zone_history,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class ZonesUpdate(BaseModel):
    """Schema for manual zone updates"""
    max_hr: Optional[int] = None
    resting_hr: Optional[int] = None
    threshold_pace: Optional[int] = None  # seconds per km
    hr_zones: Optional[dict] = None
    pace_zones: Optional[dict] = None


class AccountUpdate(BaseModel):
    """Schema for account updates"""
    name: Optional[str] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    """Schema for password changes"""
    current_password: str
    new_password: str
    confirm_password: str


@router.get("/zones/estimate")
async def estimate_zones(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate HR and pace zones from Strava activity data"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate zones"),
        )

    return result


@router.post("/zones/apply-estimate")
async def apply_estimated_zones(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate zones from Strava data and apply them to user preferences"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate zones"),
        )

    # Apply zones to user
    await apply_zones_to_user(
        current_user,
        db,
        hr_zones=result["hr_zones"],
        pace_zones=result["pace_zones"],
        max_hr=result["max_hr"],
        resting_hr=result["resting_hr"],
    )

    # Save to history
    await save_zones_to_history(current_user, db, result, source="strava_estimate")

    return {
        "message": "Zones applied successfully",
        "activities_analyzed": result["activities_analyzed"],
        "hr_zones": result["hr_zones"],
        "pace_zones": result["pace_zones"],
    }


@router.post("/zones/estimate-hr")
async def estimate_hr_only(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate HR zones from Strava data (doesn't save automatically)"""
    from app.services.zone_estimator import calculate_hr_zones_from_max

    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate HR"),
        )

    return {
        "max_hr": result["max_hr"],
        "resting_hr": result["resting_hr"],
        "hr_zones": result["hr_zones"],
        "activities_analyzed": result["activities_analyzed"],
    }


@router.post("/zones/estimate-pace")
async def estimate_pace_only(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate pace zones from Strava data (doesn't save automatically)"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate pace"),
        )

    return {
        "threshold_pace": result["threshold_pace"],
        "pace_zones": result["pace_zones"],
        "activities_analyzed": result["activities_analyzed"],
    }


@router.post("/zones/estimate-power")
async def estimate_power_only(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate cycling power zones from Strava data (doesn't save automatically).

    Estimates FTP from cycling activities using 95% of best 20-min avg power.
    Falls back to weighted avg power from longer rides if available.
    """
    from app.services.zone_estimator import calculate_cycling_power_zones_from_ftp

    cutoff_date = datetime.utcnow() - timedelta(days=days_back)

    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == current_user.id)
        .where(Activity.activity_type.in_(["Ride", "VirtualRide", "MountainBikeRide"]))
        .where(Activity.start_date >= cutoff_date)
        .order_by(desc(Activity.start_date))
    )
    rides = result.scalars().all()

    if not rides:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No cycling activities found in the last {days_back} days",
        )

    # Look for power data in raw_data (Strava includes weighted_average_watts, average_watts)
    best_avg_power = 0
    rides_with_power = 0
    for ride in rides:
        raw = ride.raw_data or {}
        weighted = raw.get("weighted_average_watts") or raw.get("average_watts")
        if weighted and weighted > 0:
            rides_with_power += 1
            duration_mins = (ride.duration or 0) / 60
            # Prefer rides >= 20 min for FTP estimation
            if duration_mins >= 20 and weighted > best_avg_power:
                best_avg_power = weighted

    if best_avg_power <= 0:
        # Fallback: use highest average_watts from any ride
        for ride in rides:
            raw = ride.raw_data or {}
            avg_w = raw.get("average_watts", 0) or 0
            if avg_w > best_avg_power:
                best_avg_power = avg_w

    if best_avg_power <= 0:
        # Check existing user FTP as last resort
        prefs = current_user.preferences or {}
        existing_ftp = prefs.get("ftp")
        if existing_ftp:
            return {
                "ftp": existing_ftp,
                "cycling_power_zones": calculate_cycling_power_zones_from_ftp(existing_ftp),
                "activities_analyzed": len(rides),
                "note": "No power data found in rides. Using existing FTP value.",
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No power data found in cycling activities. Enter FTP manually.",
        )

    # Estimate FTP as 95% of best sustained power
    estimated_ftp = int(best_avg_power * 0.95)
    power_zones = calculate_cycling_power_zones_from_ftp(estimated_ftp)

    return {
        "ftp": estimated_ftp,
        "cycling_power_zones": power_zones,
        "activities_analyzed": len(rides),
        "rides_with_power": rides_with_power,
    }


@router.put("/zones")
async def update_zones(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's training zones manually (JSON body)."""
    from sqlalchemy.orm.attributes import flag_modified

    prefs = current_user.preferences or {}
    body = await request.json()

    for key in ["max_hr", "resting_hr", "threshold_pace", "hr_zones", "pace_zones", "ftp", "cycling_power_zones"]:
        if key in body and body[key] is not None:
            prefs[key] = body[key]

    # Auto-compute cycling power zones from FTP if FTP provided but zones aren't
    if "ftp" in body and body["ftp"] is not None and "cycling_power_zones" not in body:
        from app.services.zone_estimator import calculate_cycling_power_zones_from_ftp
        prefs["cycling_power_zones"] = calculate_cycling_power_zones_from_ftp(body["ftp"])

    current_user.preferences = dict(prefs)
    flag_modified(current_user, "preferences")
    await db.commit()
    await db.refresh(current_user)

    await save_zones_to_history(
        current_user,
        db,
        {
            "max_hr": prefs.get("max_hr"),
            "resting_hr": prefs.get("resting_hr"),
            "threshold_pace": prefs.get("threshold_pace"),
            "hr_zones": prefs.get("hr_zones"),
            "pace_zones": prefs.get("pace_zones"),
            "ftp": prefs.get("ftp"),
            "cycling_power_zones": prefs.get("cycling_power_zones"),
        },
        source="manual",
    )

    return {"message": "Zones updated", "preferences": prefs}


@router.get("/zones/history")
async def get_zones_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get zone calculation history for evolution tracking"""
    history = await get_zone_history(current_user, db, limit)

    return [
        {
            "id": h.id,
            "calculated_at": h.calculated_at.isoformat() if h.calculated_at else None,
            "source": h.source,
            "activities_analyzed": h.activities_analyzed,
            "max_hr": h.max_hr,
            "resting_hr": h.resting_hr,
            "threshold_pace": h.threshold_pace,
            "hr_zones": h.hr_zones,
            "pace_zones": h.pace_zones,
            "ftp": h.ftp,
            "cycling_power_zones": h.cycling_power_zones,
        }
        for h in history
    ]


@router.post("/zones/revert/{history_id}")
async def revert_zones(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revert user zones to a historical snapshot"""
    from sqlalchemy.orm.attributes import flag_modified
    from app.models.zone_history import ZoneHistory

    result = await db.execute(
        select(ZoneHistory)
        .where(ZoneHistory.id == history_id)
        .where(ZoneHistory.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone history entry not found",
        )

    # Apply the historical snapshot to current preferences
    prefs = dict(current_user.preferences) if current_user.preferences else {}

    if entry.max_hr is not None:
        prefs["max_hr"] = entry.max_hr
    if entry.resting_hr is not None:
        prefs["resting_hr"] = entry.resting_hr
    if entry.threshold_pace is not None:
        prefs["threshold_pace"] = entry.threshold_pace
    if entry.hr_zones is not None:
        prefs["hr_zones"] = entry.hr_zones
    if entry.pace_zones is not None:
        prefs["pace_zones"] = entry.pace_zones
    if entry.ftp is not None:
        prefs["ftp"] = entry.ftp
    if entry.cycling_power_zones is not None:
        prefs["cycling_power_zones"] = entry.cycling_power_zones

    current_user.preferences = prefs
    flag_modified(current_user, "preferences")
    await db.commit()
    await db.refresh(current_user)

    # Record the revert as a new history entry
    await save_zones_to_history(
        current_user,
        db,
        {
            "max_hr": prefs.get("max_hr"),
            "resting_hr": prefs.get("resting_hr"),
            "threshold_pace": prefs.get("threshold_pace"),
            "hr_zones": prefs.get("hr_zones"),
            "pace_zones": prefs.get("pace_zones"),
            "ftp": prefs.get("ftp"),
            "cycling_power_zones": prefs.get("cycling_power_zones"),
            "notes": f"Reverted to snapshot #{history_id}",
        },
        source="reverted",
    )

    return {"message": "Zones reverted", "preferences": prefs}


@router.put("/account")
async def update_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user account details (JSON body)."""
    body = await request.json()
    name = body.get("name")
    email = body.get("email")

    if name:
        current_user.name = name
    if email and email != current_user.email:
        # Check if email is already taken
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = email

    await db.commit()

    return {"message": "Account updated", "name": current_user.name, "email": current_user.email}


@router.put("/password")
async def change_password(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password (JSON body)."""
    from app.core.security import verify_password, get_password_hash

    body = await request.json()
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")
    confirm_password = body.get("confirm_password", "")

    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    current_user.password_hash = get_password_hash(new_password)
    await db.commit()

    return {"message": "Password changed successfully"}
