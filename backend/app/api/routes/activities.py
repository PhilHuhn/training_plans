from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, extract, cast, Date
from datetime import datetime, date, timedelta
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.models.activity import Activity
from app.schemas.activity import ActivityResponse, ActivityListResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=ActivityListResponse)
async def get_activities(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    activity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's activities with optional filters"""
    query = select(Activity).where(Activity.user_id == current_user.id)

    if start_date:
        query = query.where(Activity.start_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(Activity.start_date <= datetime.combine(end_date, datetime.max.time()))
    if activity_type:
        query = query.where(Activity.activity_type == activity_type)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination and ordering
    query = query.order_by(desc(Activity.start_date))
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    activities = result.scalars().all()

    return ActivityListResponse(
        activities=[ActivityResponse.model_validate(a) for a in activities],
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/stats/by-sport")
async def get_stats_by_sport(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get activity stats grouped by sport/activity type"""
    query = select(
        Activity.activity_type,
        func.count(Activity.id).label("count"),
        func.coalesce(func.sum(Activity.distance), 0).label("total_distance"),
        func.coalesce(func.sum(Activity.duration), 0).label("total_duration"),
        func.coalesce(func.sum(Activity.elevation_gain), 0).label("total_elevation"),
        func.avg(Activity.avg_heart_rate).label("avg_hr"),
        func.coalesce(func.sum(Activity.calories), 0).label("total_calories"),
    ).where(Activity.user_id == current_user.id)

    if start_date:
        query = query.where(Activity.start_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(Activity.start_date <= datetime.combine(end_date, datetime.max.time()))

    query = query.group_by(Activity.activity_type)
    result = await db.execute(query)
    rows = result.all()

    sports = []
    for row in rows:
        sports.append({
            "sport": row.activity_type or "Unknown",
            "count": row.count,
            "distance_km": round((row.total_distance or 0) / 1000, 1),
            "duration_hours": round((row.total_duration or 0) / 3600, 1),
            "elevation_m": round(row.total_elevation or 0, 0),
            "avg_hr": round(row.avg_hr or 0, 0),
            "calories": round(row.total_calories or 0, 0),
        })

    # Sort by count descending
    sports.sort(key=lambda x: x["count"], reverse=True)
    return {"sports": sports}


@router.get("/stats/weekly-by-sport")
async def get_weekly_stats_by_sport(
    weeks: int = Query(12, ge=1, le=52),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get weekly activity stats grouped by sport for chart data"""
    end = datetime.utcnow()
    start = end - timedelta(weeks=weeks)

    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == current_user.id)
        .where(Activity.start_date >= start)
        .order_by(Activity.start_date)
    )
    activities = result.scalars().all()

    # Group by ISO week + sport
    weekly: dict[str, dict[str, dict]] = {}  # week_label -> sport -> stats
    for a in activities:
        # Calculate Monday of the week
        d = a.start_date
        monday = d - timedelta(days=d.weekday())
        week_key = monday.strftime("%Y-%m-%d")
        sport = a.activity_type or "Unknown"

        if week_key not in weekly:
            weekly[week_key] = {}
        if sport not in weekly[week_key]:
            weekly[week_key][sport] = {"distance_km": 0, "duration_hours": 0, "count": 0}

        weekly[week_key][sport]["distance_km"] += (a.distance or 0) / 1000
        weekly[week_key][sport]["duration_hours"] += (a.duration or 0) / 3600
        weekly[week_key][sport]["count"] += 1

    # Build ordered list of weeks
    weeks_data = []
    for week_key in sorted(weekly.keys()):
        entry = {"week": week_key, "sports": {}}
        for sport, stats in weekly[week_key].items():
            entry["sports"][sport] = {
                "distance_km": round(stats["distance_km"], 1),
                "duration_hours": round(stats["duration_hours"], 1),
                "count": stats["count"],
            }
        weeks_data.append(entry)

    return {"weeks": weeks_data}


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific activity"""
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == current_user.id
        )
    )
    activity = result.scalar_one_or_none()

    if not activity:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )

    return ActivityResponse.model_validate(activity)


@router.get("/stats/summary")
async def get_activity_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get summary statistics for activities"""
    query = select(
        func.count(Activity.id).label("total_activities"),
        func.sum(Activity.distance).label("total_distance"),
        func.sum(Activity.duration).label("total_duration"),
        func.sum(Activity.elevation_gain).label("total_elevation"),
        func.avg(Activity.avg_heart_rate).label("avg_heart_rate"),
        func.avg(Activity.avg_pace).label("avg_pace"),
    ).where(Activity.user_id == current_user.id)

    if start_date:
        query = query.where(Activity.start_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(Activity.start_date <= datetime.combine(end_date, datetime.max.time()))

    result = await db.execute(query)
    stats = result.one()

    return {
        "total_activities": stats.total_activities or 0,
        "total_distance_km": round((stats.total_distance or 0) / 1000, 2),
        "total_duration_hours": round((stats.total_duration or 0) / 3600, 2),
        "total_elevation_m": round(stats.total_elevation or 0, 0),
        "avg_heart_rate": round(stats.avg_heart_rate or 0, 0),
        "avg_pace_per_km": round(stats.avg_pace or 0, 0),
    }
