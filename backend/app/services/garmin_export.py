"""
Garmin FIT file export service for structured workouts.
Creates FIT workout files that can be imported into Garmin Connect or copied directly to devices.
"""

import io
import datetime
from typing import Optional
from app.schemas.training import (
    StructuredWorkout,
    WorkoutStep,
    WorkoutDetails,
    StepType,
    DurationType,
    TargetType,
)

# Try to import fit_tool - it may not be installed
try:
    from fit_tool.fit_file_builder import FitFileBuilder
    from fit_tool.profile.messages.file_id_message import FileIdMessage
    from fit_tool.profile.messages.workout_message import WorkoutMessage
    from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage
    from fit_tool.profile.profile_type import (
        Sport,
        Intensity,
        WorkoutStepDuration,
        WorkoutStepTarget,
        Manufacturer,
        FileType,
    )
    FIT_AVAILABLE = True
except ImportError:
    FIT_AVAILABLE = False


def pace_string_to_speed(pace_str: str) -> float:
    """
    Convert pace string (e.g., "5:00" for 5:00/km) to speed in m/s.
    """
    if not pace_str:
        return 0.0
    try:
        parts = pace_str.strip().split(":")
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = int(parts[1])
            total_seconds = minutes * 60 + seconds
            if total_seconds > 0:
                # pace is seconds per km, speed is m/s
                return 1000.0 / total_seconds
    except (ValueError, IndexError):
        pass
    return 0.0


def hr_zone_to_bpm(zone: int, max_hr: int = 190, resting_hr: int = 50) -> tuple[int, int]:
    """
    Convert HR zone (1-5) to BPM range using Karvonen formula.
    Returns (low_bpm, high_bpm).
    """
    hrr = max_hr - resting_hr
    zone_percentages = {
        1: (0.50, 0.60),  # Recovery
        2: (0.60, 0.70),  # Aerobic
        3: (0.70, 0.80),  # Tempo
        4: (0.80, 0.90),  # Threshold
        5: (0.90, 1.00),  # VO2max
    }
    low_pct, high_pct = zone_percentages.get(zone, (0.50, 0.60))
    low_bpm = int(resting_hr + hrr * low_pct)
    high_bpm = int(resting_hr + hrr * high_pct)
    return low_bpm, high_bpm


def convert_step_type_to_intensity(step_type: StepType) -> "Intensity":
    """Convert our step type to Garmin Intensity enum."""
    if not FIT_AVAILABLE:
        return None
    mapping = {
        StepType.WARMUP: Intensity.WARMUP,
        StepType.ACTIVE: Intensity.ACTIVE,
        StepType.RECOVERY: Intensity.RECOVERY,
        StepType.REST: Intensity.REST,
        StepType.COOLDOWN: Intensity.COOLDOWN,
        StepType.REPEAT: Intensity.ACTIVE,  # Repeats don't have their own intensity
    }
    return mapping.get(step_type, Intensity.ACTIVE)


def convert_duration_type(duration_type: DurationType) -> "WorkoutStepDuration":
    """Convert our duration type to Garmin enum."""
    if not FIT_AVAILABLE:
        return None
    mapping = {
        DurationType.TIME: WorkoutStepDuration.TIME,
        DurationType.DISTANCE: WorkoutStepDuration.DISTANCE,
        DurationType.LAP_BUTTON: WorkoutStepDuration.OPEN,
        DurationType.OPEN: WorkoutStepDuration.OPEN,
    }
    return mapping.get(duration_type, WorkoutStepDuration.OPEN)


def convert_target_type(target_type: TargetType) -> "WorkoutStepTarget":
    """Convert our target type to Garmin enum."""
    if not FIT_AVAILABLE:
        return None
    mapping = {
        TargetType.OPEN: WorkoutStepTarget.OPEN,
        TargetType.PACE: WorkoutStepTarget.SPEED,
        TargetType.HEART_RATE: WorkoutStepTarget.HEART_RATE,
        TargetType.HEART_RATE_ZONE: WorkoutStepTarget.HEART_RATE,
        TargetType.CADENCE: WorkoutStepTarget.CADENCE,
    }
    return mapping.get(target_type, WorkoutStepTarget.OPEN)


def create_fit_workout(
    workout: StructuredWorkout,
    user_preferences: Optional[dict] = None,
) -> bytes:
    """
    Create a Garmin FIT workout file from a structured workout.

    Args:
        workout: The structured workout to export
        user_preferences: User's preferences including max_hr, resting_hr, pace_zones

    Returns:
        bytes: The FIT file content
    """
    if not FIT_AVAILABLE:
        raise ImportError(
            "fit-tool library is not installed. "
            "Install it with: pip install fit-tool"
        )

    # Get user's HR settings
    prefs = user_preferences or {}
    max_hr = prefs.get("max_hr", 190)
    resting_hr = prefs.get("resting_hr", 50)

    # Create FIT file builder
    builder = FitFileBuilder(auto_define=True)

    # Add file ID message
    file_id = FileIdMessage()
    file_id.type = FileType.WORKOUT
    file_id.manufacturer = Manufacturer.DEVELOPMENT.value
    file_id.product = 0
    file_id.serial_number = 12345
    file_id.time_created = round(datetime.datetime.now().timestamp() * 1000)
    builder.add(file_id)

    # Add workout message
    workout_msg = WorkoutMessage()
    workout_msg.workout_name = workout.name[:20] if workout.name else "Workout"  # Max 20 chars
    workout_msg.sport = Sport.RUNNING
    workout_msg.num_valid_steps = _count_total_steps(workout.steps)
    builder.add(workout_msg)

    # Add workout steps
    step_index = 0
    for step in workout.steps:
        step_index = _add_workout_step(
            builder, step, step_index, max_hr, resting_hr
        )

    # Build and return the FIT file bytes
    fit_file = builder.build()
    return fit_file.to_bytes()


def _count_total_steps(steps: list[WorkoutStep]) -> int:
    """Count total number of steps including repeat sub-steps."""
    count = 0
    for step in steps:
        count += 1
        if step.step_type == StepType.REPEAT and step.repeat_steps:
            count += len(step.repeat_steps)
    return count


def _add_workout_step(
    builder: "FitFileBuilder",
    step: WorkoutStep,
    step_index: int,
    max_hr: int,
    resting_hr: int,
) -> int:
    """
    Add a workout step to the FIT file builder.
    Returns the next step index.
    """
    if step.step_type == StepType.REPEAT and step.repeat_steps:
        # For repeats, first add all the sub-steps
        first_sub_index = step_index
        for sub_step in step.repeat_steps:
            step_msg = _create_step_message(
                sub_step, step_index, max_hr, resting_hr
            )
            builder.add(step_msg)
            step_index += 1

        # Then add the repeat step that references back
        repeat_msg = WorkoutStepMessage()
        repeat_msg.message_index = step_index
        repeat_msg.intensity = Intensity.ACTIVE
        repeat_msg.duration_type = WorkoutStepDuration.REPEAT_UNTIL_STEPS_CMPLT
        repeat_msg.duration_value = step.repeat_count or 1
        repeat_msg.target_type = WorkoutStepTarget.OPEN
        repeat_msg.target_value = first_sub_index  # Reference to first step in repeat
        builder.add(repeat_msg)
        step_index += 1
    else:
        step_msg = _create_step_message(step, step_index, max_hr, resting_hr)
        builder.add(step_msg)
        step_index += 1

    return step_index


def _create_step_message(
    step: WorkoutStep,
    step_index: int,
    max_hr: int,
    resting_hr: int,
) -> "WorkoutStepMessage":
    """Create a FIT WorkoutStepMessage from our WorkoutStep."""
    msg = WorkoutStepMessage()
    msg.message_index = step_index
    msg.intensity = convert_step_type_to_intensity(step.step_type)

    # Set duration
    msg.duration_type = convert_duration_type(step.duration_type)
    if step.duration_type == DurationType.TIME and step.duration_value:
        msg.duration_value = int(step.duration_value * 1000)  # Convert to milliseconds
    elif step.duration_type == DurationType.DISTANCE and step.duration_value:
        msg.duration_value = int(step.duration_value * 100)  # Convert to centimeters

    # Set target
    msg.target_type = convert_target_type(step.target_type)

    if step.target_type == TargetType.PACE:
        # Convert pace to speed (m/s) for Garmin
        if step.target_value_low and step.target_value_high:
            # Pace values are in sec/km, convert to m/s
            # Note: higher pace number = slower speed
            speed_high = 1000.0 / step.target_value_low if step.target_value_low > 0 else 0
            speed_low = 1000.0 / step.target_value_high if step.target_value_high > 0 else 0
            msg.custom_target_value_low = int(speed_low * 1000)  # mm/s
            msg.custom_target_value_high = int(speed_high * 1000)
    elif step.target_type == TargetType.HEART_RATE:
        if step.target_value_low and step.target_value_high:
            msg.custom_target_value_low = int(step.target_value_low)
            msg.custom_target_value_high = int(step.target_value_high)
    elif step.target_type == TargetType.HEART_RATE_ZONE and step.target_zone:
        low_bpm, high_bpm = hr_zone_to_bpm(step.target_zone, max_hr, resting_hr)
        msg.custom_target_value_low = low_bpm
        msg.custom_target_value_high = high_bpm

    return msg


def workout_details_to_structured(
    workout: WorkoutDetails,
    session_date: Optional[datetime.date] = None,
) -> StructuredWorkout:
    """
    Convert a simple WorkoutDetails to a StructuredWorkout for export.
    Uses AI-parsed intervals if available, otherwise creates a simple structure.
    """
    steps = []
    workout_name = f"{workout.type.replace('_', ' ').title()}"
    if session_date:
        workout_name = f"{session_date.strftime('%m/%d')} {workout_name}"

    # Parse pace range if available
    pace_low = None
    pace_high = None
    if workout.pace_range:
        try:
            parts = workout.pace_range.replace("/km", "").split("-")
            if len(parts) == 2:
                # Convert "5:00-5:30" to seconds
                def parse_pace(p):
                    m, s = p.strip().split(":")
                    return int(m) * 60 + int(s)
                pace_low = parse_pace(parts[0])
                pace_high = parse_pace(parts[1])
        except (ValueError, IndexError):
            pass

    # Determine target type and values
    target_type = TargetType.OPEN
    target_low = None
    target_high = None
    target_zone = None

    if pace_low and pace_high:
        target_type = TargetType.PACE
        target_low = pace_low
        target_high = pace_high
    elif workout.hr_zone:
        target_type = TargetType.HEART_RATE_ZONE
        try:
            target_zone = int(workout.hr_zone.replace("zone", ""))
        except ValueError:
            target_zone = 2

    # Check if workout has interval structure
    if workout.intervals and len(workout.intervals) > 0:
        # Add warmup
        steps.append(WorkoutStep(
            step_type=StepType.WARMUP,
            name="Warm Up",
            duration_type=DurationType.TIME,
            duration_value=600,  # 10 min default warmup
            target_type=TargetType.OPEN,
        ))

        # Parse intervals
        for interval in workout.intervals:
            repeat_steps = []

            # Work interval
            work_duration_type = DurationType.DISTANCE
            work_duration = interval.get("distance_m", 400)  # Default 400m
            if "duration_sec" in interval:
                work_duration_type = DurationType.TIME
                work_duration = interval["duration_sec"]

            # Parse target pace from interval if available
            interval_target_type = TargetType.OPEN
            interval_target_low = None
            interval_target_high = None
            if "target_pace" in interval:
                try:
                    pace_parts = interval["target_pace"].split(":")
                    pace_sec = int(pace_parts[0]) * 60 + int(pace_parts[1])
                    interval_target_type = TargetType.PACE
                    interval_target_low = pace_sec - 5  # 5 sec tolerance
                    interval_target_high = pace_sec + 5
                except (ValueError, IndexError):
                    pass

            repeat_steps.append(WorkoutStep(
                step_type=StepType.ACTIVE,
                name="Work",
                duration_type=work_duration_type,
                duration_value=work_duration,
                target_type=interval_target_type,
                target_value_low=interval_target_low,
                target_value_high=interval_target_high,
            ))

            # Recovery interval
            recovery_duration = 90  # Default 90 sec
            if "recovery" in interval:
                try:
                    # Parse "90s" or "2min" format
                    rec = interval["recovery"].lower()
                    if "min" in rec:
                        recovery_duration = int(rec.replace("min", "").strip()) * 60
                    elif "s" in rec:
                        recovery_duration = int(rec.replace("s", "").strip())
                except ValueError:
                    pass

            repeat_steps.append(WorkoutStep(
                step_type=StepType.RECOVERY,
                name="Recovery",
                duration_type=DurationType.TIME,
                duration_value=recovery_duration,
                target_type=TargetType.OPEN,
            ))

            # Add repeat step
            reps = interval.get("reps", 1)
            steps.append(WorkoutStep(
                step_type=StepType.REPEAT,
                name=f"{reps}x{interval.get('distance_m', 400)}m",
                repeat_count=reps,
                repeat_steps=repeat_steps,
            ))

        # Add cooldown
        steps.append(WorkoutStep(
            step_type=StepType.COOLDOWN,
            name="Cool Down",
            duration_type=DurationType.TIME,
            duration_value=600,  # 10 min default cooldown
            target_type=TargetType.OPEN,
        ))
    else:
        # Simple workout - warmup, main, cooldown
        total_duration = (workout.duration_min or 45) * 60  # Default 45 min
        total_distance = (workout.distance_km or 0) * 1000  # Convert to meters

        warmup_duration = min(600, total_duration // 6)  # ~10 min or 1/6 of workout
        cooldown_duration = warmup_duration
        main_duration = total_duration - warmup_duration - cooldown_duration

        # Warmup
        steps.append(WorkoutStep(
            step_type=StepType.WARMUP,
            name="Warm Up",
            duration_type=DurationType.TIME,
            duration_value=warmup_duration,
            target_type=TargetType.OPEN,
        ))

        # Main set
        if total_distance > 0:
            main_distance = total_distance - 2000  # Reserve ~2km for warmup/cooldown
            main_distance = max(main_distance, 1000)  # At least 1km
            steps.append(WorkoutStep(
                step_type=StepType.ACTIVE,
                name=workout.type.replace("_", " ").title(),
                duration_type=DurationType.DISTANCE,
                duration_value=main_distance,
                target_type=target_type,
                target_value_low=target_low,
                target_value_high=target_high,
                target_zone=target_zone,
            ))
        else:
            steps.append(WorkoutStep(
                step_type=StepType.ACTIVE,
                name=workout.type.replace("_", " ").title(),
                duration_type=DurationType.TIME,
                duration_value=main_duration,
                target_type=target_type,
                target_value_low=target_low,
                target_value_high=target_high,
                target_zone=target_zone,
            ))

        # Cooldown
        steps.append(WorkoutStep(
            step_type=StepType.COOLDOWN,
            name="Cool Down",
            duration_type=DurationType.TIME,
            duration_value=cooldown_duration,
            target_type=TargetType.OPEN,
        ))

    return StructuredWorkout(
        name=workout_name[:20],  # Garmin limit
        sport="running",
        description=workout.description,
        steps=steps,
        estimated_duration_min=workout.duration_min,
        estimated_distance_km=workout.distance_km,
    )
