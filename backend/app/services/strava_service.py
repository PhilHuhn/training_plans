import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.user import User
from app.models.activity import Activity
from app.core.claude_client import ClaudeClient
from app.core.config import settings

STRAVA_API_URL = "https://www.strava.com/api/v3"


async def sync_strava_activities(
    user: User,
    access_token: str,
    db: AsyncSession,
    days_back: int = 30
) -> int:
    """
    Sync all activities from Strava for the last N days.
    Includes running, cycling, swimming, and other activity types.
    Also fetches detailed lap data for running activities.
    Returns the number of newly synced activities.
    """
    # Calculate date range
    after_timestamp = int((datetime.utcnow() - timedelta(days=days_back)).timestamp())

    synced_count = 0
    page = 1
    per_page = 50
    new_activity_ids = []  # Track new activities for lap fetching

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            # Fetch activities from Strava
            response = await client.get(
                f"{STRAVA_API_URL}/athlete/activities",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "after": after_timestamp,
                    "page": page,
                    "per_page": per_page,
                }
            )

            if response.status_code != 200:
                break

            activities_data = response.json()

            if not activities_data:
                break

            for activity_data in activities_data:
                activity_type = activity_data.get("type", "")
                strava_id = str(activity_data["id"])

                # Check if activity already exists
                result = await db.execute(
                    select(Activity).where(Activity.strava_id == strava_id)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    continue

                # Calculate pace (seconds per km) - only for running activities
                distance = activity_data.get("distance", 0)
                moving_time = activity_data.get("moving_time", 0)
                avg_pace = None
                if distance and distance > 0 and activity_type in ["Run", "TrailRun", "VirtualRun"]:
                    avg_pace = (moving_time / distance) * 1000  # seconds per km

                # Parse dates - convert to naive UTC datetimes for database
                start_date_str = activity_data["start_date"]
                start_date = datetime.fromisoformat(
                    start_date_str.replace("Z", "+00:00")
                ).replace(tzinfo=None)  # Strip timezone, store as naive UTC

                start_date_local = None
                if activity_data.get("start_date_local"):
                    start_date_local = datetime.fromisoformat(
                        activity_data["start_date_local"].replace("Z", "")
                    )

                # Create new activity
                activity = Activity(
                    user_id=user.id,
                    strava_id=strava_id,
                    name=activity_data.get("name", "Untitled Activity"),
                    activity_type=activity_type,
                    description=activity_data.get("description"),
                    distance=distance,
                    duration=moving_time,
                    elevation_gain=activity_data.get("total_elevation_gain"),
                    calories=activity_data.get("calories"),
                    avg_heart_rate=activity_data.get("average_heartrate"),
                    max_heart_rate=activity_data.get("max_heartrate"),
                    avg_pace=avg_pace,
                    start_date=start_date,
                    start_date_local=start_date_local,
                    raw_data=activity_data,
                    # Strava workout classification
                    # For runs: 0=default, 1=race, 2=long run, 3=workout
                    # For rides: 10=default, 11=race, 12=workout
                    workout_type=activity_data.get("workout_type"),
                    is_commute=1 if activity_data.get("commute") else 0,
                )

                db.add(activity)
                synced_count += 1

                # Track running activities for lap fetching
                if activity_type in ["Run", "TrailRun", "VirtualRun"]:
                    new_activity_ids.append(strava_id)

            page += 1

            # Safety limit
            if page > 10:
                break

        await db.commit()

        # Fetch detailed lap data for new running activities
        for strava_id in new_activity_ids:
            try:
                laps_data = await fetch_activity_laps(client, access_token, strava_id)
                if laps_data:
                    result = await db.execute(
                        select(Activity).where(Activity.strava_id == strava_id)
                    )
                    activity = result.scalar_one_or_none()
                    if activity:
                        activity.laps_data = laps_data
            except Exception as e:
                print(f"Warning: Failed to fetch laps for activity {strava_id}: {e}")

        await db.commit()

    return synced_count


async def fetch_activity_laps(
    client: httpx.AsyncClient,
    access_token: str,
    strava_activity_id: str
) -> list:
    """
    Fetch detailed lap data for a specific activity from Strava.
    This gives us insight into workout structure (intervals, tempo sections, etc.)
    """
    try:
        response = await client.get(
            f"{STRAVA_API_URL}/activities/{strava_activity_id}/laps",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code == 200:
            laps = response.json()
            # Extract key data from each lap
            processed_laps = []
            for lap in laps:
                processed_laps.append({
                    "name": lap.get("name"),
                    "distance": lap.get("distance"),  # meters
                    "elapsed_time": lap.get("elapsed_time"),  # seconds
                    "moving_time": lap.get("moving_time"),  # seconds
                    "average_speed": lap.get("average_speed"),  # m/s
                    "max_speed": lap.get("max_speed"),  # m/s
                    "average_heartrate": lap.get("average_heartrate"),
                    "max_heartrate": lap.get("max_heartrate"),
                    "lap_index": lap.get("lap_index"),
                    "split": lap.get("split"),
                    "pace_zone": lap.get("pace_zone"),
                })
            return processed_laps
        return []
    except Exception as e:
        print(f"Error fetching laps: {e}")
        return []


def format_pace(seconds_per_km: float) -> str:
    """Format pace as min:sec per km"""
    if not seconds_per_km:
        return "--:--"
    minutes = int(seconds_per_km // 60)
    seconds = int(seconds_per_km % 60)
    return f"{minutes}:{seconds:02d}"


def parse_pace(pace_string: str) -> float:
    """Parse pace string (e.g., '5:30') to seconds per km"""
    parts = pace_string.split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid pace format: {pace_string}")
    minutes = int(parts[0])
    seconds = int(parts[1])
    return minutes * 60 + seconds


def analyze_laps_for_workout_type(laps_data: list) -> str:
    """
    Analyze lap data to determine workout type (interval, tempo, etc.)
    Returns detected workout type or None.
    """
    if not laps_data or len(laps_data) < 2:
        return None

    # Look for patterns in lap paces
    paces = []
    for lap in laps_data:
        if lap.get("moving_time") and lap.get("distance") and lap["distance"] > 0:
            pace = lap["moving_time"] / lap["distance"] * 1000  # sec/km
            paces.append(pace)

    if len(paces) < 2:
        return None

    # Calculate pace variance
    avg_pace = sum(paces) / len(paces)
    pace_variance = sum((p - avg_pace) ** 2 for p in paces) / len(paces)
    pace_std = pace_variance ** 0.5

    # High variance suggests intervals (fast/slow alternation)
    # Check for alternating fast/slow pattern
    fast_laps = sum(1 for p in paces if p < avg_pace - 15)  # >15 sec/km faster
    slow_laps = sum(1 for p in paces if p > avg_pace + 15)  # >15 sec/km slower

    if fast_laps >= 3 and slow_laps >= 2 and pace_std > 20:
        return "intervals"
    elif pace_std < 10 and len(paces) > 3:
        # Very consistent pace - could be tempo or easy
        if avg_pace < 300:  # <5:00/km
            return "tempo"
    return None


async def generate_user_profile_summary(
    user: User,
    db: AsyncSession,
) -> str:
    """
    Generate an AI profile summary based on user's activity history.
    This profile can be used to personalize training recommendations.
    Analyzes lap data to accurately detect workout types like intervals.
    """
    # Get activity statistics from the last 90 days
    cutoff_date = datetime.utcnow() - timedelta(days=90)

    # Fetch aggregated stats for RUNNING activities only
    stats_result = await db.execute(
        select(
            func.count(Activity.id).label("total_runs"),
            func.sum(Activity.distance).label("total_distance"),
            func.sum(Activity.duration).label("total_duration"),
            func.avg(Activity.avg_pace).label("avg_pace"),
            func.avg(Activity.avg_heart_rate).label("avg_hr"),
            func.max(Activity.distance).label("longest_run"),
            func.avg(Activity.elevation_gain).label("avg_elevation"),
        )
        .where(Activity.user_id == user.id)
        .where(Activity.start_date >= cutoff_date)
        .where(Activity.activity_type.in_(["Run", "TrailRun", "VirtualRun"]))
    )
    stats = stats_result.one()

    # Get all activity types for cross-training analysis
    all_activities_result = await db.execute(
        select(Activity.activity_type, func.count(Activity.id))
        .where(Activity.user_id == user.id)
        .where(Activity.start_date >= cutoff_date)
        .group_by(Activity.activity_type)
    )
    activity_type_counts = {row[0]: row[1] for row in all_activities_result.all()}

    # Get recent running activities for variety analysis (including lap data)
    recent_result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user.id)
        .where(Activity.start_date >= cutoff_date)
        .where(Activity.activity_type.in_(["Run", "TrailRun", "VirtualRun"]))
        .order_by(Activity.start_date.desc())
        .limit(30)
    )
    recent_activities = recent_result.scalars().all()

    # If no activities, return a simple profile
    if not stats.total_runs or stats.total_runs == 0:
        return "New runner with no recent activity data. Recommend starting with a beginner-friendly plan."

    # Calculate weekly averages
    weeks = 13  # ~90 days
    weekly_distance = (stats.total_distance or 0) / 1000 / weeks
    weekly_runs = (stats.total_runs or 0) / weeks
    weekly_time = (stats.total_duration or 0) / 60 / weeks

    # Prepare stats for Claude
    profile_data = {
        "name": user.name,
        "total_runs_90d": stats.total_runs,
        "total_distance_km": round((stats.total_distance or 0) / 1000, 1),
        "total_time_hours": round((stats.total_duration or 0) / 3600, 1),
        "avg_pace_per_km": format_pace(stats.avg_pace) if stats.avg_pace else "N/A",
        "avg_heart_rate": round(stats.avg_hr) if stats.avg_hr else "N/A",
        "longest_run_km": round((stats.longest_run or 0) / 1000, 1),
        "avg_elevation_per_run": round(stats.avg_elevation or 0),
        "weekly_distance_avg_km": round(weekly_distance, 1),
        "weekly_runs_avg": round(weekly_runs, 1),
        "weekly_time_avg_min": round(weekly_time),
    }

    # Analyze recent activities for patterns - use Strava tags, lap data, and name
    workout_types = {
        "intervals": 0,
        "tempo": 0,
        "long_runs": 0,
        "easy": 0,
        "races": 0,
        "other": 0
    }

    for act in recent_activities:
        detected_type = None

        # First priority: Strava workout_type tag (user-tagged, most reliable)
        # For runs: 0=default, 1=race, 2=long run, 3=workout
        if act.workout_type is not None:
            if act.workout_type == 1:
                detected_type = "races"
            elif act.workout_type == 2:
                detected_type = "long_runs"
            elif act.workout_type == 3:
                # "workout" in Strava means structured/interval work
                detected_type = "intervals"

        # Second priority: Lap data analysis (detects intervals from pace variance)
        if not detected_type and act.laps_data:
            detected_type = analyze_laps_for_workout_type(act.laps_data)

        # Third priority: Name-based detection
        if not detected_type:
            name_lower = act.name.lower() if act.name else ""
            if any(kw in name_lower for kw in ["tempo", "threshold", "t-run"]):
                detected_type = "tempo"
            elif any(kw in name_lower for kw in ["interval", "speed", "track", "fartlek", "rep", "400", "800", "1k", "1000"]):
                detected_type = "intervals"
            elif any(kw in name_lower for kw in ["long", "lsd"]):
                detected_type = "long_runs"
            elif any(kw in name_lower for kw in ["recovery", "easy", "shake"]):
                detected_type = "easy"
            elif any(kw in name_lower for kw in ["race", "parkrun", "5k", "10k", "marathon", "half"]):
                detected_type = "races"

        # Fourth priority: Distance-based heuristics
        if not detected_type and act.distance:
            distance_km = act.distance / 1000
            if distance_km > 18:
                detected_type = "long_runs"
            else:
                detected_type = "other"

        if detected_type:
            workout_types[detected_type] = workout_types.get(detected_type, 0) + 1

    profile_data["workout_variety"] = {k: v for k, v in workout_types.items() if v > 0}
    profile_data["cross_training"] = {k: v for k, v in activity_type_counts.items()
                                       if k not in ["Run", "TrailRun", "VirtualRun"]}

    # User preferences
    prefs = user.preferences or {}
    profile_data["max_hr"] = prefs.get("max_hr", "Not set")
    profile_data["resting_hr"] = prefs.get("resting_hr", "Not set")

    # Generate profile using Claude - plain text, no markdown
    prompt = f"""Based on the following activity data for {user.name}, generate a concise athlete profile summary (3-5 sentences).

RUNNING Statistics (Last 90 Days):
- Total runs: {profile_data['total_runs_90d']}
- Total distance: {profile_data['total_distance_km']} km
- Total time: {profile_data['total_time_hours']} hours
- Average pace: {profile_data['avg_pace_per_km']} /km
- Average heart rate: {profile_data['avg_heart_rate']} bpm
- Longest single run: {profile_data['longest_run_km']} km
- Average elevation gain per run: {profile_data['avg_elevation_per_run']} m
- Weekly averages: {profile_data['weekly_distance_avg_km']} km, {profile_data['weekly_runs_avg']} runs, {profile_data['weekly_time_avg_min']} min

Detected Workout Types: {profile_data['workout_variety']}
Cross-Training Activities: {profile_data['cross_training']}
Max HR: {profile_data['max_hr']}, Resting HR: {profile_data['resting_hr']}

Summarize this runner's:
1. Current fitness level (beginner/intermediate/advanced)
2. Training volume and consistency
3. Workout variety - note the detected workout types from lap analysis
4. Cross-training habits if any
5. Any notable strengths or areas for improvement

Keep it concise and actionable for training recommendations. Do NOT use any markdown formatting like **bold** or *italic*. Write plain text only. Do NOT include any pleasantries or preamble - just the profile summary."""

    try:
        claude = ClaudeClient()
        response = await claude.generate_text(prompt, max_tokens=400)
        return response.strip()
    except Exception as e:
        # Fallback to a basic profile if Claude fails
        fitness_level = "intermediate"
        if weekly_distance < 20:
            fitness_level = "beginner"
        elif weekly_distance > 50:
            fitness_level = "advanced"

        return (
            f"{fitness_level.title()} runner averaging {profile_data['weekly_distance_avg_km']} km/week "
            f"over {profile_data['weekly_runs_avg']:.1f} runs. "
            f"Average pace: {profile_data['avg_pace_per_km']}/km. "
            f"Longest recent run: {profile_data['longest_run_km']} km."
        )


async def update_user_profile_after_sync(
    user: User,
    db: AsyncSession,
) -> None:
    """
    Update the user's profile_summary after syncing activities.
    """
    profile_summary = await generate_user_profile_summary(user, db)
    user.profile_summary = profile_summary
    await db.commit()
