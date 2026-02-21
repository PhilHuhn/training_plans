"""
Zone estimation service - calculates HR and pace zones from activity data.

Uses standard training zone models:
- HR zones based on max HR (Coggan/Friel 5-zone model)
- Pace zones based on threshold/race paces
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.models.user import User
from app.models.activity import Activity
from app.models.zone_history import ZoneHistory


def calculate_hr_zones_from_max(max_hr: int, resting_hr: int = 50) -> dict:
    """
    Calculate 5 HR zones using the Karvonen formula (heart rate reserve).
    Zone names match Strava's standard HR zones.
    """
    hrr = max_hr - resting_hr

    def hr_at_percent(percent: float) -> int:
        return int(resting_hr + (hrr * percent / 100))

    return {
        "zone1": {"min": hr_at_percent(50), "max": hr_at_percent(60), "name": "Active Recovery"},
        "zone2": {"min": hr_at_percent(60) + 1, "max": hr_at_percent(70), "name": "Endurance"},
        "zone3": {"min": hr_at_percent(70) + 1, "max": hr_at_percent(80), "name": "Tempo"},
        "zone4": {"min": hr_at_percent(80) + 1, "max": hr_at_percent(90), "name": "Threshold"},
        "zone5": {"min": hr_at_percent(90) + 1, "max": max_hr, "name": "Anaerobic"},
    }


def calculate_cycling_power_zones_from_ftp(ftp: int) -> dict:
    """
    Calculate 7 cycling power zones based on FTP using Coggan model.
    Zone names and count match Strava's standard power zones.
    """
    return {
        "zone1": {"min": 0, "max": int(ftp * 0.55), "name": "Active Recovery"},
        "zone2": {"min": int(ftp * 0.55) + 1, "max": int(ftp * 0.75), "name": "Endurance"},
        "zone3": {"min": int(ftp * 0.75) + 1, "max": int(ftp * 0.90), "name": "Tempo"},
        "zone4": {"min": int(ftp * 0.90) + 1, "max": int(ftp * 1.05), "name": "Threshold"},
        "zone5": {"min": int(ftp * 1.05) + 1, "max": int(ftp * 1.20), "name": "VO2 Max"},
        "zone6": {"min": int(ftp * 1.20) + 1, "max": int(ftp * 1.50), "name": "Anaerobic"},
        "zone7": {"min": int(ftp * 1.50) + 1, "max": int(ftp * 2.00), "name": "Neuromuscular"},
    }


def calculate_pace_zones_from_threshold(threshold_pace: float) -> dict:
    """
    Calculate 6 pace zones based on threshold pace (seconds per km).
    Zone names and count match Strava's standard running pace zones.

    Note: For pace, min = slower (higher seconds), max = faster (lower seconds).
    """
    def pace_at_percent(percent: float) -> int:
        return int(threshold_pace * percent / 100)

    return {
        "zone1": {"min": pace_at_percent(135), "max": pace_at_percent(115), "name": "Active Recovery"},
        "zone2": {"min": pace_at_percent(115), "max": pace_at_percent(105), "name": "Endurance"},
        "zone3": {"min": pace_at_percent(105), "max": pace_at_percent(100), "name": "Tempo"},
        "zone4": {"min": pace_at_percent(100), "max": pace_at_percent(95), "name": "Threshold"},
        "zone5": {"min": pace_at_percent(95), "max": pace_at_percent(85), "name": "VO2 Max"},
        "zone6": {"min": pace_at_percent(85), "max": pace_at_percent(75), "name": "Anaerobic"},
    }


async def estimate_zones_from_strava(
    user: User,
    db: AsyncSession,
    days_back: int = 90
) -> dict:
    """
    Estimate HR and pace zones from Strava activity data.

    Returns estimated zones and metadata about the estimation.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)

    # Get running activities from the date range
    # Include all common running activity types from Strava
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user.id)
        .where(Activity.activity_type.in_(["Run", "run", "RUNNING", "TrailRun", "VirtualRun"]))
        .where(Activity.start_date >= cutoff_date)
        .order_by(desc(Activity.start_date))
    )
    activities = result.scalars().all()

    print(f"[DEBUG] Zone estimation: Found {len(activities)} activities for user {user.id}")

    if not activities:
        return {
            "success": False,
            "error": "No running activities found in the last {days_back} days",
            "activities_analyzed": 0
        }

    # Collect HR and pace data
    max_hrs = []
    avg_hrs = []
    avg_paces = []

    easy_run_hrs = []
    easy_run_paces = []
    tempo_run_hrs = []
    tempo_run_paces = []

    for activity in activities:
        if activity.max_heart_rate:
            max_hrs.append(activity.max_heart_rate)
        if activity.avg_heart_rate:
            avg_hrs.append(activity.avg_heart_rate)
        if activity.avg_pace and activity.avg_pace > 0:
            avg_paces.append(activity.avg_pace)

        # Categorize runs by duration/intensity
        # Easy runs: longer duration, lower HR
        # Tempo runs: medium duration, higher HR
        duration_mins = (activity.duration or 0) / 60

        if duration_mins > 45 and activity.avg_heart_rate:
            # Longer runs are typically easy runs
            easy_run_hrs.append(activity.avg_heart_rate)
            if activity.avg_pace:
                easy_run_paces.append(activity.avg_pace)
        elif 20 <= duration_mins <= 45 and activity.avg_heart_rate:
            # Medium runs could be tempo
            if activity.avg_heart_rate > 150:  # Higher HR indicates tempo
                tempo_run_hrs.append(activity.avg_heart_rate)
                if activity.avg_pace:
                    tempo_run_paces.append(activity.avg_pace)

    # Calculate max HR (use highest recorded, or estimate from age)
    estimated_max_hr = max(max_hrs) if max_hrs else 190

    # Get existing user preferences for resting HR
    prefs = user.preferences or {}
    resting_hr = prefs.get("resting_hr", 50)

    # Calculate HR zones
    hr_zones = calculate_hr_zones_from_max(estimated_max_hr, resting_hr)

    # Estimate threshold pace from tempo runs or fastest average paces
    if avg_paces:
        # Use the 20th percentile as threshold pace approximation
        sorted_paces = sorted(avg_paces)
        threshold_idx = max(0, int(len(sorted_paces) * 0.2))
        threshold_pace = sorted_paces[threshold_idx]
    else:
        threshold_pace = 300  # Default 5:00/km

    pace_zones = calculate_pace_zones_from_threshold(threshold_pace)

    # Calculate averages for metrics
    avg_hr_easy = sum(easy_run_hrs) / len(easy_run_hrs) if easy_run_hrs else None
    avg_hr_tempo = sum(tempo_run_hrs) / len(tempo_run_hrs) if tempo_run_hrs else None
    avg_pace_easy = sum(easy_run_paces) / len(easy_run_paces) if easy_run_paces else None
    avg_pace_tempo = sum(tempo_run_paces) / len(tempo_run_paces) if tempo_run_paces else None

    return {
        "success": True,
        "activities_analyzed": len(activities),
        "date_range_start": cutoff_date,
        "date_range_end": datetime.utcnow(),
        "max_hr": estimated_max_hr,
        "resting_hr": resting_hr,
        "threshold_pace": threshold_pace,
        "hr_zones": hr_zones,
        "pace_zones": pace_zones,
        "avg_hr_easy_runs": avg_hr_easy,
        "avg_hr_tempo_runs": avg_hr_tempo,
        "avg_pace_easy_runs": avg_pace_easy,
        "avg_pace_tempo_runs": avg_pace_tempo,
    }


async def save_zones_to_history(
    user: User,
    db: AsyncSession,
    zones_data: dict,
    source: str = "strava_estimate"
) -> ZoneHistory:
    """Save zone calculation to history for evolution tracking."""
    history_entry = ZoneHistory(
        user_id=user.id,
        source=source,
        activities_analyzed=zones_data.get("activities_analyzed"),
        date_range_start=zones_data.get("date_range_start"),
        date_range_end=zones_data.get("date_range_end"),
        max_hr=zones_data.get("max_hr"),
        resting_hr=zones_data.get("resting_hr"),
        hr_zones=zones_data.get("hr_zones"),
        threshold_pace=zones_data.get("threshold_pace"),
        pace_zones=zones_data.get("pace_zones"),
        ftp=zones_data.get("ftp"),
        cycling_power_zones=zones_data.get("cycling_power_zones"),
        avg_hr_easy_runs=zones_data.get("avg_hr_easy_runs"),
        avg_hr_tempo_runs=zones_data.get("avg_hr_tempo_runs"),
        avg_pace_easy_runs=zones_data.get("avg_pace_easy_runs"),
        avg_pace_tempo_runs=zones_data.get("avg_pace_tempo_runs"),
        notes=zones_data.get("notes"),
    )
    db.add(history_entry)
    await db.commit()
    await db.refresh(history_entry)
    return history_entry


async def apply_zones_to_user(
    user: User,
    db: AsyncSession,
    hr_zones: dict,
    pace_zones: dict,
    max_hr: Optional[int] = None,
    resting_hr: Optional[int] = None
) -> User:
    """Apply calculated zones to user preferences."""
    # Create a new dict to ensure SQLAlchemy detects the change
    prefs = dict(user.preferences) if user.preferences else {}

    prefs["hr_zones"] = hr_zones
    prefs["pace_zones"] = pace_zones
    if max_hr:
        prefs["max_hr"] = int(max_hr)
    if resting_hr:
        prefs["resting_hr"] = int(resting_hr)

    # Assign new dict to trigger SQLAlchemy change detection
    user.preferences = prefs

    # Mark the column as modified explicitly
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "preferences")

    await db.commit()
    await db.refresh(user)
    return user


async def get_zone_history(
    user: User,
    db: AsyncSession,
    limit: int = 10
) -> list[ZoneHistory]:
    """Get zone calculation history for a user."""
    result = await db.execute(
        select(ZoneHistory)
        .where(ZoneHistory.user_id == user.id)
        .order_by(desc(ZoneHistory.calculated_at))
        .limit(limit)
    )
    return result.scalars().all()
