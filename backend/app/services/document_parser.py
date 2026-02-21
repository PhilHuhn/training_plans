import io
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.training_session import TrainingSession, UploadedPlan, SessionSource
from app.core.claude_client import claude_client
from app.prompts.training_recommendation import (
    DOCUMENT_PARSING_SYSTEM,
    DOCUMENT_PARSING_PROMPT,
)


async def extract_text_from_file(
    file_content: bytes,
    content_type: str,
    filename: str
) -> str:
    """
    Extract text content from uploaded file (PDF, Word, plain text, or Markdown).
    """
    if content_type == "application/pdf" or filename.endswith(".pdf"):
        return extract_from_pdf(file_content)
    elif content_type in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
    ] or filename.endswith((".docx", ".doc")):
        return extract_from_docx(file_content)
    elif content_type.startswith("text/") or filename.endswith((".txt", ".md")):
        return file_content.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type: {content_type}")


def extract_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            text_parts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n\n".join(text_parts)
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")


def extract_from_docx(file_content: bytes) -> str:
    """Extract text from Word document."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_content))
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        return "\n".join(text_parts)
    except Exception as e:
        raise ValueError(f"Failed to parse Word document: {str(e)}")


async def parse_training_plan(
    document_text: str,
    start_date: Optional[date] = None
) -> dict:
    """
    Use Claude to parse training plan document text into structured sessions.
    """
    if start_date is None:
        # Default to next Monday
        today = date.today()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        start_date = today + timedelta(days=days_until_monday)

    prompt = DOCUMENT_PARSING_PROMPT.format(
        document_text=document_text,
        start_date=start_date.isoformat(),
    )

    result = await claude_client.parse_document(
        DOCUMENT_PARSING_SYSTEM,
        prompt
    )

    return result


def create_structured_workout_from_data(
    workout_data: dict,
    session_date: date
) -> Optional[dict]:
    """
    Create a structured workout dict from parsed workout data.
    Returns a dict that matches the StructuredWorkout schema for Garmin export.
    """
    workout_type = workout_data.get("type", "easy")
    description = workout_data.get("description", "")
    intervals = workout_data.get("intervals")
    distance_km = workout_data.get("distance_km")
    duration_min = workout_data.get("duration_min")
    pace_range = workout_data.get("pace_range")
    hr_zone = workout_data.get("hr_zone")

    # Generate workout name
    workout_name = f"{session_date.strftime('%m/%d')} {workout_type.replace('_', ' ').title()}"
    if len(workout_name) > 20:
        workout_name = workout_name[:20]

    steps = []

    # Parse pace range if available
    pace_low_sec = None
    pace_high_sec = None
    if pace_range:
        try:
            parts = pace_range.replace("/km", "").split("-")
            if len(parts) >= 1:
                m, s = parts[0].strip().split(":")
                pace_low_sec = int(m) * 60 + int(s)
            if len(parts) >= 2:
                m, s = parts[1].strip().split(":")
                pace_high_sec = int(m) * 60 + int(s)
        except (ValueError, IndexError):
            pass

    # Parse HR zone
    target_zone = None
    if hr_zone:
        try:
            target_zone = int(hr_zone.replace("zone", ""))
        except ValueError:
            pass

    # Build structured workout based on type
    if intervals and len(intervals) > 0:
        # Interval workout with warmup, intervals, cooldown
        # Warmup
        steps.append({
            "step_type": "warmup",
            "name": "Warm Up",
            "duration_type": "time",
            "duration_value": 600,  # 10 min
            "target_type": "open",
        })

        # Process intervals
        for interval in intervals:
            repeat_steps = []

            # Work interval
            work_duration_type = "distance"
            work_duration = interval.get("distance_m", 400)
            if "duration_sec" in interval:
                work_duration_type = "time"
                work_duration = interval["duration_sec"]

            # Parse target pace from interval
            interval_target_type = "open"
            interval_target_low = None
            interval_target_high = None
            target_pace = interval.get("target_pace")
            if target_pace:
                try:
                    pace_parts = target_pace.replace("/km", "").strip().split(":")
                    pace_sec = int(pace_parts[0]) * 60 + int(pace_parts[1])
                    interval_target_type = "pace"
                    interval_target_low = pace_sec - 5
                    interval_target_high = pace_sec + 5
                except (ValueError, IndexError):
                    pass

            work_step = {
                "step_type": "active",
                "name": "Work",
                "duration_type": work_duration_type,
                "duration_value": work_duration,
                "target_type": interval_target_type,
            }
            if interval_target_low:
                work_step["target_value_low"] = interval_target_low
                work_step["target_value_high"] = interval_target_high

            repeat_steps.append(work_step)

            # Recovery
            recovery_duration = 90
            recovery_str = interval.get("recovery", "")
            if recovery_str:
                try:
                    rec = recovery_str.lower()
                    if "min" in rec:
                        recovery_duration = int(rec.replace("min", "").strip()) * 60
                    elif "s" in rec:
                        recovery_duration = int(rec.replace("s", "").replace("ec", "").strip())
                except ValueError:
                    pass

            repeat_steps.append({
                "step_type": "recovery",
                "name": "Recovery",
                "duration_type": "time",
                "duration_value": recovery_duration,
                "target_type": "open",
            })

            # Add repeat step
            reps = interval.get("reps", 1)
            steps.append({
                "step_type": "repeat",
                "name": f"{reps}x{interval.get('distance_m', '?')}m",
                "repeat_count": reps,
                "repeat_steps": repeat_steps,
            })

        # Cooldown
        steps.append({
            "step_type": "cooldown",
            "name": "Cool Down",
            "duration_type": "time",
            "duration_value": 600,  # 10 min
            "target_type": "open",
        })

    else:
        # Simple workout: warmup, main, cooldown
        total_duration = (duration_min or 45) * 60
        total_distance = (distance_km or 0) * 1000

        warmup_duration = min(600, total_duration // 6)
        cooldown_duration = warmup_duration
        main_duration = total_duration - warmup_duration - cooldown_duration

        # Warmup
        steps.append({
            "step_type": "warmup",
            "name": "Warm Up",
            "duration_type": "time",
            "duration_value": warmup_duration,
            "target_type": "open",
        })

        # Main set
        main_step = {
            "step_type": "active",
            "name": workout_type.replace("_", " ").title(),
        }

        if total_distance > 0:
            main_distance = max(total_distance - 2000, 1000)
            main_step["duration_type"] = "distance"
            main_step["duration_value"] = main_distance
        else:
            main_step["duration_type"] = "time"
            main_step["duration_value"] = main_duration

        # Add target
        if pace_low_sec and pace_high_sec:
            main_step["target_type"] = "pace"
            main_step["target_value_low"] = pace_low_sec
            main_step["target_value_high"] = pace_high_sec
        elif target_zone:
            main_step["target_type"] = "heart_rate_zone"
            main_step["target_zone"] = target_zone
        else:
            main_step["target_type"] = "open"

        steps.append(main_step)

        # Cooldown
        steps.append({
            "step_type": "cooldown",
            "name": "Cool Down",
            "duration_type": "time",
            "duration_value": cooldown_duration,
            "target_type": "open",
        })

    return {
        "name": workout_name,
        "sport": "running",
        "description": description,
        "steps": steps,
        "estimated_duration_min": duration_min,
        "estimated_distance_km": distance_km,
    }


async def process_uploaded_plan(
    user: User,
    db: AsyncSession,
    file_content: bytes,
    content_type: str,
    filename: str,
    start_date: Optional[date] = None
) -> UploadedPlan:
    """
    Process an uploaded training plan document:
    1. Extract text
    2. Parse with Claude
    3. Create training sessions
    4. Store in database
    """
    # Extract text
    document_text = await extract_text_from_file(file_content, content_type, filename)

    # Parse with Claude
    parsed_result = await parse_training_plan(document_text, start_date)

    # Create UploadedPlan record
    uploaded_plan = UploadedPlan(
        user_id=user.id,
        filename=filename,
        content_type=content_type,
        content_text=document_text,
        parsed_sessions=parsed_result.get("sessions", []),
        is_active=1,
    )
    db.add(uploaded_plan)
    await db.flush()  # Get the ID

    # Create TrainingSession records for each parsed session
    sessions = parsed_result.get("sessions", [])
    for session_data in sessions:
        session_date_str = session_data.get("date")
        if not session_date_str:
            continue

        try:
            session_date = date.fromisoformat(session_date_str)
        except ValueError:
            continue

        # Check if session already exists
        from sqlalchemy import select
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user.id)
            .where(TrainingSession.session_date == session_date)
        )
        existing = result.scalar_one_or_none()

        # Extract only workout-relevant fields (exclude date, day_of_week)
        workout_data = {
            "type": session_data.get("type", "easy"),
            "description": session_data.get("description", ""),
            "distance_km": session_data.get("distance_km"),
            "duration_min": session_data.get("duration_min"),
            "intensity": session_data.get("intensity"),
            "hr_zone": session_data.get("hr_zone"),
            "pace_range": session_data.get("pace_range"),
            "intervals": session_data.get("intervals"),
            "notes": session_data.get("notes"),
        }

        # Generate structured workout for Garmin export if intervals are present
        structured = create_structured_workout_from_data(workout_data, session_date)
        if structured:
            workout_data["structured"] = structured

        if existing:
            # Update planned workout on existing session
            existing.planned_workout = workout_data
            existing.source = SessionSource.UPLOADED_PLAN
            existing.uploaded_plan_id = uploaded_plan.id
        else:
            # Create new session
            session = TrainingSession(
                user_id=user.id,
                session_date=session_date,
                source=SessionSource.UPLOADED_PLAN,
                planned_workout=workout_data,
                uploaded_plan_id=uploaded_plan.id,
            )
            db.add(session)

    await db.commit()
    await db.refresh(uploaded_plan)

    return uploaded_plan
