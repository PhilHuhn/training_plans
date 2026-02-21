from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.zone_history import ZoneHistory
from app.api.deps import get_current_user
from app.services.zone_estimator import (
    estimate_zones_from_strava,
    save_zones_to_history,
    apply_zones_to_user,
    get_zone_history,
    calculate_hr_zones_from_max,
    calculate_pace_zones_from_threshold,
)

router = APIRouter(prefix="/settings", tags=["settings"])

# Templates
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


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


def is_htmx_request(request: Request) -> bool:
    """Check if request is from HTMX"""
    return request.headers.get("HX-Request") == "true"


@router.get("/zones/estimate")
async def estimate_zones(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Estimate HR and pace zones from Strava activity data"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate zones")
        )

    return result


@router.post("/zones/apply-estimate")
async def apply_estimated_zones(
    request: Request,
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Estimate zones from Strava data and apply them to user preferences"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        if is_htmx_request(request):
            return HTMLResponse(
                f'<div class="text-red-600">{result.get("error", "Failed to estimate zones")}</div>',
                status_code=400
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate zones")
        )

    # Apply zones to user
    await apply_zones_to_user(
        current_user,
        db,
        hr_zones=result["hr_zones"],
        pace_zones=result["pace_zones"],
        max_hr=result["max_hr"],
        resting_hr=result["resting_hr"]
    )

    # Save to history
    await save_zones_to_history(current_user, db, result, source="strava_estimate")

    if is_htmx_request(request):
        # Return success message and trigger page reload to show new values in form
        return HTMLResponse(
            f'<div class="text-green-600">Zones updated from {result["activities_analyzed"]} activities! '
            f'Max HR: {result["max_hr"]} bpm</div>'
            f'<script>setTimeout(() => window.location.reload(), 1500)</script>'
        )

    return {
        "message": "Zones applied successfully",
        "activities_analyzed": result["activities_analyzed"],
        "hr_zones": result["hr_zones"],
        "pace_zones": result["pace_zones"]
    }


@router.post("/zones/estimate-hr")
async def estimate_hr_only(
    request: Request,
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Estimate max and resting HR from Strava data (doesn't save automatically)"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        if is_htmx_request(request):
            return HTMLResponse(
                f'<div class="text-red-600 text-xs">{result.get("error", "Failed to estimate HR")}</div>',
                status_code=400
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate HR")
        )

    if is_htmx_request(request):
        # Return JS to fill in the form fields
        return HTMLResponse(
            f'<div class="text-green-600 text-xs">Found max HR: {result["max_hr"]} bpm from {result["activities_analyzed"]} activities</div>'
            f'<script>'
            f'document.getElementById("max_hr").value = {result["max_hr"]};'
            f'document.getElementById("resting_hr").value = {result["resting_hr"]};'
            f'</script>'
        )

    return {
        "max_hr": result["max_hr"],
        "resting_hr": result["resting_hr"],
        "activities_analyzed": result["activities_analyzed"]
    }


@router.post("/zones/estimate-pace")
async def estimate_pace_only(
    request: Request,
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Estimate threshold pace from Strava data (doesn't save automatically)"""
    result = await estimate_zones_from_strava(current_user, db, days_back)

    if not result.get("success"):
        if is_htmx_request(request):
            return HTMLResponse(
                f'<div class="text-red-600 text-xs">{result.get("error", "Failed to estimate pace")}</div>',
                status_code=400
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to estimate pace")
        )

    threshold_pace = result["threshold_pace"]
    # Format as min:sec
    mins = int(threshold_pace // 60)
    secs = int(threshold_pace % 60)
    pace_str = f"{mins}:{secs:02d}"

    if is_htmx_request(request):
        return HTMLResponse(
            f'<div class="text-green-600 text-xs">Found threshold pace: {pace_str}/km from {result["activities_analyzed"]} activities</div>'
            f'<script>'
            f'document.getElementById("threshold_pace").value = "{pace_str}";'
            f'</script>'
        )

    return {
        "threshold_pace": threshold_pace,
        "threshold_pace_str": pace_str,
        "activities_analyzed": result["activities_analyzed"]
    }


@router.put("/zones")
async def update_zones(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's training zones manually. Accepts JSON or form data."""
    from sqlalchemy.orm.attributes import flag_modified

    prefs = current_user.preferences or {}
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        # JSON body from React SPA
        body = await request.json()
        for key in ["max_hr", "resting_hr", "threshold_pace", "hr_zones", "pace_zones"]:
            if key in body and body[key] is not None:
                prefs[key] = body[key]
    else:
        # Form data from HTMX templates
        form = await request.form()

        def parse_pace(pace_str):
            if not pace_str or str(pace_str).strip() == "":
                return None
            try:
                parts = str(pace_str).strip().split(":")
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
                return int(pace_str)
            except (ValueError, TypeError):
                return None

        max_hr = form.get("max_hr")
        resting_hr = form.get("resting_hr")
        if max_hr is not None and str(max_hr).strip():
            prefs["max_hr"] = int(max_hr)
        if resting_hr is not None and str(resting_hr).strip():
            prefs["resting_hr"] = int(resting_hr)

        threshold_pace = form.get("threshold_pace")
        threshold_pace_sec = parse_pace(threshold_pace)
        if threshold_pace_sec is not None:
            prefs["threshold_pace"] = threshold_pace_sec

        hr_zones = prefs.get("hr_zones", {})
        for i in range(1, 6):
            z_min = form.get(f"hr_zone_{i}_min")
            z_max = form.get(f"hr_zone_{i}_max")
            if z_min is not None or z_max is not None:
                zone_names = {1: "Recovery", 2: "Aerobic", 3: "Tempo", 4: "Threshold", 5: "VO2max"}
                hr_zones[f"zone{i}"] = {
                    "min": int(z_min) if z_min else 0,
                    "max": int(z_max) if z_max else 220,
                    "name": zone_names[i],
                }
        if hr_zones:
            prefs["hr_zones"] = hr_zones

        pace_zones = prefs.get("pace_zones", {})
        for i in range(1, 6):
            p_min = parse_pace(form.get(f"pace_zone_{i}_min"))
            p_max = parse_pace(form.get(f"pace_zone_{i}_max"))
            if p_min is not None or p_max is not None:
                zone_names = {1: "Easy", 2: "Moderate", 3: "Tempo", 4: "Threshold", 5: "Interval"}
                pace_zones[f"zone{i}"] = {
                    "min": p_min or 240,
                    "max": p_max or 420,
                    "name": zone_names[i],
                }
        if pace_zones:
            prefs["pace_zones"] = pace_zones

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
        },
        source="manual",
    )

    if is_htmx_request(request):
        return HTMLResponse('<div class="text-green-600">Zones saved!</div>')

    return {"message": "Zones updated", "preferences": prefs}


@router.get("/zones/history")
async def get_zones_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
            "hr_zones": h.hr_zones,
            "pace_zones": h.pace_zones,
        }
        for h in history
    ]


@router.put("/account")
async def update_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user account details. Accepts JSON or form data."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        name = body.get("name")
        email = body.get("email")
    else:
        form = await request.form()
        name = form.get("name")
        email = form.get("email")

    if name:
        current_user.name = name
    if email and email != current_user.email:
        # Check if email is already taken
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            if is_htmx_request(request):
                return HTMLResponse('<div class="text-red-600">Email already in use</div>', status_code=400)
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = email

    await db.commit()

    if is_htmx_request(request):
        return HTMLResponse('<div class="text-green-600">Account updated!</div>')

    return {"message": "Account updated", "name": current_user.name, "email": current_user.email}


@router.put("/password")
async def change_password(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password. Accepts JSON or form data."""
    from app.core.security import verify_password, get_password_hash

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        current_password = body.get("current_password", "")
        new_password = body.get("new_password", "")
        confirm_password = body.get("confirm_password", "")
    else:
        form = await request.form()
        current_password = form.get("current_password", "")
        new_password = form.get("new_password", "")
        confirm_password = form.get("confirm_password", "")

    if not verify_password(current_password, current_user.password_hash):
        if is_htmx_request(request):
            return HTMLResponse('<div class="text-red-600">Current password is incorrect</div>', status_code=400)
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if new_password != confirm_password:
        if is_htmx_request(request):
            return HTMLResponse('<div class="text-red-600">Passwords do not match</div>', status_code=400)
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if len(new_password) < 8:
        if is_htmx_request(request):
            return HTMLResponse('<div class="text-red-600">Password must be at least 8 characters</div>', status_code=400)
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    current_user.password_hash = get_password_hash(new_password)
    await db.commit()

    if is_htmx_request(request):
        return HTMLResponse('<div class="text-green-600">Password changed!</div>')

    return {"message": "Password changed successfully"}
