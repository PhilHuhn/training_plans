from datetime import date, datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.user import User
from app.models.activity import Activity
from app.models.competition import Competition
from app.models.training_session import TrainingSession, SessionSource, SessionStatus
from app.core.claude_client import claude_client
from app.prompts.training_recommendation import (
    TRAINING_RECOMMENDATION_SYSTEM,
    TRAINING_RECOMMENDATION_PROMPT,
    PLAN_CONVERSION_SYSTEM,
    PLAN_CONVERSION_PROMPT,
)
from app.services.strava_service import format_pace


async def generate_recommendations(
    user: User,
    db: AsyncSession,
    start_date: date,
    end_date: date,
    consider_fixed_plan: bool = True,
    include_cross_training: bool = True,
) -> dict:
    """
    Generate training recommendations for a user for the given date range.
    """
    # Get recent activities (last 30 days for better context)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user.id)
        .where(Activity.start_date >= thirty_days_ago)
        .order_by(desc(Activity.start_date))
    )
    recent_activities = result.scalars().all()

    # Calculate weekly stats (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    week_activities = [a for a in recent_activities if a.start_date >= seven_days_ago]

    weekly_distance = sum(a.distance or 0 for a in week_activities) / 1000
    weekly_duration = sum(a.duration or 0 for a in week_activities) / 3600
    weekly_avg_hr = sum(a.avg_heart_rate or 0 for a in week_activities) / max(len(week_activities), 1)

    # Count sessions by sport type
    run_types = {"run", "running", "trail run", "treadmill"}
    ride_types = {"ride", "cycling", "virtualride", "virtual ride"}
    weekly_runs = sum(1 for a in week_activities if (a.activity_type or "").lower() in run_types)
    weekly_rides = sum(1 for a in week_activities if (a.activity_type or "").lower() in ride_types)
    weekly_other = len(week_activities) - weekly_runs - weekly_rides

    # Get all competitions within the planning period (and slightly beyond for taper planning)
    result = await db.execute(
        select(Competition)
        .where(Competition.user_id == user.id)
        .where(Competition.race_date >= start_date)
        .where(Competition.race_date <= end_date + timedelta(days=14))  # Include races slightly after end
        .order_by(Competition.race_date)
    )
    upcoming_competitions = result.scalars().all()

    # Get fixed plan sessions for the date range
    fixed_plan_text = "No fixed training plan."
    if consider_fixed_plan:
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user.id)
            .where(TrainingSession.session_date >= start_date)
            .where(TrainingSession.session_date <= end_date)
            .where(TrainingSession.planned_workout.isnot(None))
            .order_by(TrainingSession.session_date)
        )
        fixed_sessions = result.scalars().all()
        if fixed_sessions:
            fixed_plan_text = "\n".join([
                f"- {s.session_date}: {s.planned_workout.get('description', 'No description')}"
                for s in fixed_sessions
            ])

    # Format activities for prompt (show up to 15 activities for better context)
    activities_text = "No recent activities." if not recent_activities else "\n".join([
        f"- {a.start_date.strftime('%Y-%m-%d')}: [{a.activity_type or 'Run'}] {a.name} - "
        f"{(a.distance or 0)/1000:.1f}km, "
        f"{format_pace(a.avg_pace)}/km, "
        f"HR: {a.avg_heart_rate or 'N/A'}bpm"
        for a in recent_activities[:15]
    ])

    # Format competitions for prompt with days until race
    if not upcoming_competitions:
        competitions_text = "No upcoming competitions."
    else:
        comp_lines = []
        for c in upcoming_competitions:
            days_until = (c.race_date - start_date).days
            # Handle enum values safely (may be string or enum)
            race_type = c.race_type.value if hasattr(c.race_type, 'value') else str(c.race_type)
            priority = c.priority.value if hasattr(c.priority, 'value') else str(c.priority)
            comp_lines.append(
                f"- {c.race_date}: {c.name} ({race_type}) - "
                f"Priority: {priority}, "
                f"Goal: {format_goal_time(c.goal_time)}, "
                f"Days until: {days_until}"
            )
        competitions_text = "\n".join(comp_lines)

    # Format zones
    preferences = user.preferences or {}
    hr_zones = preferences.get("hr_zones", {})
    pace_zones = preferences.get("pace_zones", {})

    hr_zones_text = "\n".join([
        f"- {zone}: {data.get('min', 0)}-{data.get('max', 0)} bpm ({data.get('name', zone)})"
        for zone, data in hr_zones.items()
    ]) or "Default zones"

    pace_zones_text = "\n".join([
        f"- {zone}: {format_pace(data.get('min', 0))}-{format_pace(data.get('max', 0))}/km ({data.get('name', zone)})"
        for zone, data in pace_zones.items()
    ]) or "Default zones"

    # Format cycling power zones
    ftp = preferences.get("ftp")
    cycling_power_zones = preferences.get("cycling_power_zones", {})

    ftp_text = f"{ftp}W" if ftp else "Not set"

    cycling_power_zones_text = "\n".join([
        f"- {zone}: {data.get('min', 0)}-{data.get('max', 0)}W ({data.get('name', zone)})"
        for zone, data in cycling_power_zones.items()
    ]) or "Not configured (no FTP set)"

    # Calculate planning duration
    planning_days = (end_date - start_date).days
    planning_weeks = planning_days // 7

    # Get athlete profile summary
    athlete_profile = user.profile_summary or "No profile summary available."

    # Get threshold pace for context
    threshold_pace = preferences.get("threshold_pace")
    threshold_pace_text = format_pace(threshold_pace) if threshold_pace else "Not set"

    # Build prompt
    prompt = TRAINING_RECOMMENDATION_PROMPT.format(
        athlete_name=user.name,
        max_hr=preferences.get("max_hr", 190),
        resting_hr=preferences.get("resting_hr", 50),
        threshold_pace=threshold_pace_text,
        ftp=ftp_text,
        athlete_profile=athlete_profile,
        hr_zones=hr_zones_text,
        pace_zones=pace_zones_text,
        cycling_power_zones=cycling_power_zones_text,
        recent_activities=activities_text,
        weekly_distance=f"{weekly_distance:.1f}",
        weekly_duration=f"{weekly_duration:.1f}",
        weekly_avg_hr=f"{weekly_avg_hr:.0f}",
        weekly_runs=weekly_runs,
        weekly_rides=weekly_rides,
        weekly_other=weekly_other,
        upcoming_competitions=competitions_text,
        fixed_plan=fixed_plan_text,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        planning_weeks=planning_weeks,
    )

    if not include_cross_training:
        prompt += (
            "\n\nIMPORTANT: The athlete has requested a RUNNING-ONLY plan. "
            "Do NOT include cross-training sessions (cycling, swimming, strength, etc.). "
            "All sessions should have sport='running'. Use rest days instead of cross-training days."
        )

    # Call Claude
    result = await claude_client.generate_training_recommendations(
        TRAINING_RECOMMENDATION_SYSTEM,
        prompt
    )

    return result


async def convert_session(
    user: User,
    workout: dict,
    target_type: str,  # "hr_based" or "pace_based"
) -> dict:
    """
    Convert a training session between pace-based and HR-based formats.
    """
    preferences = user.preferences or {}
    hr_zones = preferences.get("hr_zones", {})
    pace_zones = preferences.get("pace_zones", {})

    source_type = "pace-based" if target_type == "hr_based" else "HR-based"

    hr_zones_text = "\n".join([
        f"- {zone}: {data.get('min', 0)}-{data.get('max', 0)} bpm ({data.get('name', zone)})"
        for zone, data in hr_zones.items()
    ])

    pace_zones_text = "\n".join([
        f"- {zone}: {format_pace(data.get('min', 0))}-{format_pace(data.get('max', 0))}/km ({data.get('name', zone)})"
        for zone, data in pace_zones.items()
    ])

    import json
    session_details = json.dumps(workout, indent=2)

    prompt = PLAN_CONVERSION_PROMPT.format(
        source_type=source_type,
        target_type=target_type.replace("_", " "),
        hr_zones=hr_zones_text,
        pace_zones=pace_zones_text,
        session_details=session_details,
        workout_type=workout.get("type", "easy"),
    )

    result = await claude_client.convert_session(
        PLAN_CONVERSION_SYSTEM,
        prompt
    )

    return result


async def save_recommendations(
    user: User,
    db: AsyncSession,
    recommendations: dict
) -> list[TrainingSession]:
    """
    Save generated recommendations to the database.
    Only saves to future days (including today). Always replaces AI recommendation column.
    """
    sessions = recommendations.get("sessions", [])
    saved_sessions = []
    today = date.today()

    for session_data in sessions:
        session_date_str = session_data.get("date")
        if not session_date_str:
            continue

        session_date = date.fromisoformat(session_date_str)

        # Only process future days (including today)
        if session_date < today:
            continue

        # Check if session already exists for this date
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user.id)
            .where(TrainingSession.session_date == session_date)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Always replace AI recommendation on existing session
            existing.recommendation_workout = session_data
        else:
            # Create new session
            session = TrainingSession(
                user_id=user.id,
                session_date=session_date,
                source=SessionSource.APP_RECOMMENDATION,
                recommendation_workout=session_data,
            )
            db.add(session)
            saved_sessions.append(session)

    await db.commit()
    return saved_sessions


def format_goal_time(seconds: Optional[int]) -> str:
    """Format goal time from seconds to HH:MM:SS or MM:SS"""
    if not seconds:
        return "N/A"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"
