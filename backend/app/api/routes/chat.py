"""
AI Chat routes - Interactive chatbot for training plan assistance.
Supports reading and modifying training sessions, providing feedback, and answering questions.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
import json
import anthropic

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.training_session import TrainingSession
from app.models.activity import Activity
from app.models.competition import Competition
from app.api.deps import get_current_user


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    stream: bool = True


class ChatResponse(BaseModel):
    message: ChatMessage
    tool_results: Optional[list[dict]] = None


# Define tools that Claude can use
CHAT_TOOLS = [
    {
        "name": "get_training_sessions",
        "description": "Get training sessions for a date range. Use this to see what workouts are planned.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format"
                }
            },
            "required": ["start_date", "end_date"]
        }
    },
    {
        "name": "get_session_details",
        "description": "Get detailed information about a specific training session by ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "integer",
                    "description": "The session ID"
                }
            },
            "required": ["session_id"]
        }
    },
    {
        "name": "update_session_workout",
        "description": "Update a training session's workout. By default writes to AI recommendation column. Set write_to_manual=true only if user explicitly asks to write to their manual/planned column.",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "integer",
                    "description": "The session ID to update"
                },
                "workout_type": {
                    "type": "string",
                    "enum": ["easy", "tempo", "interval", "long_run", "recovery", "cross_training", "rest"],
                    "description": "Type of workout"
                },
                "description": {
                    "type": "string",
                    "description": "Workout description"
                },
                "distance_km": {
                    "type": "number",
                    "description": "Distance in kilometers"
                },
                "duration_min": {
                    "type": "integer",
                    "description": "Duration in minutes"
                },
                "intensity": {
                    "type": "string",
                    "enum": ["low", "moderate", "high"],
                    "description": "Workout intensity"
                },
                "pace_range": {
                    "type": "string",
                    "description": "Pace range like '5:00-5:30'"
                },
                "hr_zone": {
                    "type": "string",
                    "description": "Heart rate zone like 'zone2'"
                },
                "write_to_manual": {
                    "type": "boolean",
                    "description": "If true, write to manual/planned column instead of AI recommendation. Only set true if user explicitly requests it."
                }
            },
            "required": ["session_id", "workout_type", "description"]
        }
    },
    {
        "name": "create_session",
        "description": "Create a new training session for a specific date. By default writes to AI recommendation column. Set write_to_manual=true only if user explicitly asks to write to their manual/planned column.",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format"
                },
                "workout_type": {
                    "type": "string",
                    "enum": ["easy", "tempo", "interval", "long_run", "recovery", "cross_training", "rest"],
                    "description": "Type of workout"
                },
                "description": {
                    "type": "string",
                    "description": "Workout description"
                },
                "distance_km": {
                    "type": "number",
                    "description": "Distance in kilometers"
                },
                "duration_min": {
                    "type": "integer",
                    "description": "Duration in minutes"
                },
                "intensity": {
                    "type": "string",
                    "enum": ["low", "moderate", "high"],
                    "description": "Workout intensity"
                },
                "pace_range": {
                    "type": "string",
                    "description": "Pace range like '5:00-5:30'"
                },
                "write_to_manual": {
                    "type": "boolean",
                    "description": "If true, write to manual/planned column instead of AI recommendation. Only set true if user explicitly requests it."
                }
            },
            "required": ["session_date", "workout_type", "description"]
        }
    },
    {
        "name": "get_recent_activities",
        "description": "Get recent completed activities from Strava. Use this to understand the user's recent training load.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Number of days to look back (default 14)"
                }
            }
        }
    },
    {
        "name": "get_upcoming_competitions",
        "description": "Get the user's upcoming races/competitions.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_user_zones",
        "description": "Get the user's heart rate and pace zones.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    }
]


CHAT_SYSTEM_PROMPT = """You are Turbi, the AI coach for the Turbine Turmweg Training app.
You help users with their training plans, provide feedback on workouts, and can modify their training schedule.

You have access to tools to:
- View training sessions and activities
- Modify existing workouts
- Create new training sessions
- View upcoming competitions
- View user's HR and pace zones

When modifying workouts, always explain what you're changing and why.
Be encouraging but realistic about training goals.
Consider the user's recent training load when making suggestions.
Use the user's configured zones when relevant.

Today's date is {today}.
{profile_section}
"""


async def execute_tool(
    tool_name: str,
    tool_input: dict,
    user: User,
    db: AsyncSession,
) -> str:
    """Execute a tool and return the result as a string."""

    if tool_name == "get_training_sessions":
        start = datetime.strptime(tool_input["start_date"], "%Y-%m-%d").date()
        end = datetime.strptime(tool_input["end_date"], "%Y-%m-%d").date()

        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user.id)
            .where(TrainingSession.session_date >= start)
            .where(TrainingSession.session_date <= end)
            .order_by(TrainingSession.session_date)
        )
        sessions = result.scalars().all()

        if not sessions:
            return f"No training sessions found between {start} and {end}."

        output = []
        for s in sessions:
            workout = s.final_workout or s.planned_workout or s.recommendation_workout
            if workout:
                output.append(
                    f"- {s.session_date}: ID={s.id}, {workout.get('type', 'unknown')} - "
                    f"{workout.get('description', 'No description')}, "
                    f"{workout.get('distance_km', 'N/A')} km"
                )
            else:
                output.append(f"- {s.session_date}: ID={s.id}, No workout defined")

        return "\n".join(output)

    elif tool_name == "get_session_details":
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.id == tool_input["session_id"])
            .where(TrainingSession.user_id == user.id)
        )
        session = result.scalar_one_or_none()

        if not session:
            return "Session not found."

        return json.dumps({
            "id": session.id,
            "date": session.session_date.isoformat(),
            "planned_workout": session.planned_workout,
            "recommendation_workout": session.recommendation_workout,
            "final_workout": session.final_workout,
            "status": session.status.value,
            "accepted_source": session.accepted_source,
        }, indent=2)

    elif tool_name == "update_session_workout":
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.id == tool_input["session_id"])
            .where(TrainingSession.user_id == user.id)
        )
        session = result.scalar_one_or_none()

        if not session:
            return "Session not found."

        workout = {
            "type": tool_input["workout_type"],
            "description": tool_input["description"],
            "distance_km": tool_input.get("distance_km"),
            "duration_min": tool_input.get("duration_min"),
            "intensity": tool_input.get("intensity"),
            "pace_range": tool_input.get("pace_range"),
            "hr_zone": tool_input.get("hr_zone"),
        }

        # Write to manual/planned column if explicitly requested, otherwise AI recommendation
        write_to_manual = tool_input.get("write_to_manual", False)
        if write_to_manual:
            session.planned_workout = workout
            column_name = "manual/planned"
        else:
            session.recommendation_workout = workout
            column_name = "AI recommendation"
        await db.commit()

        return f"Updated session {session.id} on {session.session_date} ({column_name} column) with new workout: {tool_input['description']}"

    elif tool_name == "create_session":
        from app.models.training_session import SessionSource

        session_date = datetime.strptime(tool_input["session_date"], "%Y-%m-%d").date()
        write_to_manual = tool_input.get("write_to_manual", False)

        # Check if session already exists
        result = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user.id)
            .where(TrainingSession.session_date == session_date)
        )
        existing = result.scalar_one_or_none()

        workout = {
            "type": tool_input["workout_type"],
            "description": tool_input["description"],
            "distance_km": tool_input.get("distance_km"),
            "duration_min": tool_input.get("duration_min"),
            "intensity": tool_input.get("intensity"),
            "pace_range": tool_input.get("pace_range"),
        }

        if existing:
            # Update existing session instead of failing
            if write_to_manual:
                existing.planned_workout = workout
                column_name = "manual/planned"
            else:
                existing.recommendation_workout = workout
                column_name = "AI recommendation"
            await db.commit()
            return f"Updated existing session on {session_date} (ID={existing.id}, {column_name} column): {tool_input['description']}"

        # Create new session
        if write_to_manual:
            session = TrainingSession(
                user_id=user.id,
                session_date=session_date,
                source=SessionSource.MANUAL,
                planned_workout=workout,
            )
            column_name = "manual/planned"
        else:
            session = TrainingSession(
                user_id=user.id,
                session_date=session_date,
                source=SessionSource.APP_RECOMMENDATION,
                recommendation_workout=workout,
            )
            column_name = "AI recommendation"
        db.add(session)
        await db.commit()
        await db.refresh(session)

        return f"Created new session on {session_date} (ID={session.id}, {column_name} column): {tool_input['description']}"

    elif tool_name == "get_recent_activities":
        days = tool_input.get("days", 14)
        cutoff = datetime.utcnow() - timedelta(days=days)

        result = await db.execute(
            select(Activity)
            .where(Activity.user_id == user.id)
            .where(Activity.start_date >= cutoff)
            .order_by(Activity.start_date.desc())
        )
        activities = result.scalars().all()

        if not activities:
            return f"No activities found in the last {days} days."

        output = []
        total_km = 0
        for a in activities:
            km = round(a.distance / 1000, 1) if a.distance else 0
            total_km += km
            pace = ""
            if a.avg_pace:
                mins = int(a.avg_pace // 60)
                secs = int(a.avg_pace % 60)
                pace = f", {mins}:{secs:02d}/km"
            output.append(
                f"- {a.start_date.strftime('%Y-%m-%d')}: {a.name}, {km} km{pace}"
            )

        output.append(f"\nTotal: {round(total_km, 1)} km in {days} days")
        return "\n".join(output)

    elif tool_name == "get_upcoming_competitions":
        result = await db.execute(
            select(Competition)
            .where(Competition.user_id == user.id)
            .where(Competition.race_date >= date.today())
            .order_by(Competition.race_date)
        )
        competitions = result.scalars().all()

        if not competitions:
            return "No upcoming competitions."

        output = []
        for c in competitions:
            days_until = (c.race_date - date.today()).days
            output.append(
                f"- {c.race_date}: {c.name} ({c.race_type}), "
                f"Goal: {c.goal_time or 'Not set'}, "
                f"Priority: {c.priority or 'N/A'}, "
                f"{days_until} days away"
            )

        return "\n".join(output)

    elif tool_name == "get_user_zones":
        prefs = user.preferences or {}

        output = []

        if prefs.get("max_hr"):
            output.append(f"Max HR: {prefs['max_hr']} bpm")
        if prefs.get("resting_hr"):
            output.append(f"Resting HR: {prefs['resting_hr']} bpm")
        if prefs.get("threshold_pace"):
            mins = int(prefs['threshold_pace'] // 60)
            secs = int(prefs['threshold_pace'] % 60)
            output.append(f"Threshold Pace: {mins}:{secs:02d}/km")

        hr_zones = prefs.get("hr_zones", {})
        if hr_zones:
            output.append("\nHR Zones:")
            for zone, values in hr_zones.items():
                output.append(f"  {zone}: {values.get('min', 'N/A')}-{values.get('max', 'N/A')} bpm")

        pace_zones = prefs.get("pace_zones", {})
        if pace_zones:
            output.append("\nPace Zones:")
            for zone, values in pace_zones.items():
                def fmt(v):
                    if not v:
                        return "N/A"
                    m = int(v // 60)
                    s = int(v % 60)
                    return f"{m}:{s:02d}"
                output.append(f"  {zone}: {fmt(values.get('min'))}-{fmt(values.get('max'))}/km")

        return "\n".join(output) if output else "No zones configured."

    return f"Unknown tool: {tool_name}"


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a chat message and get a response (optionally streamed)."""

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Build messages for API
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # System prompt with today's date and user profile
    profile_section = ""
    if current_user.profile_summary:
        profile_section = f"\n\nUser Profile:\n{current_user.profile_summary}"
    system = CHAT_SYSTEM_PROMPT.format(
        today=date.today().isoformat(),
        profile_section=profile_section
    )

    if request.stream:
        async def generate():
            # Non-streaming for now due to tool use complexity
            # TODO: Implement proper streaming with tool use
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system,
                tools=CHAT_TOOLS,
                messages=messages,
            )

            # Handle tool use
            while response.stop_reason == "tool_use":
                # Find tool use blocks
                tool_uses = [b for b in response.content if b.type == "tool_use"]
                tool_results = []

                for tool_use in tool_uses:
                    result = await execute_tool(
                        tool_use.name,
                        tool_use.input,
                        current_user,
                        db
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": result
                    })

                # Continue the conversation with tool results
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=2048,
                    system=system,
                    tools=CHAT_TOOLS,
                    messages=messages,
                )

            # Extract final text response
            text_content = ""
            for block in response.content:
                if hasattr(block, "text"):
                    text_content += block.text

            # Return as SSE
            yield f"data: {json.dumps({'content': text_content, 'done': True})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    else:
        # Non-streaming response
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=system,
            tools=CHAT_TOOLS,
            messages=messages,
        )

        # Handle tool use
        tool_results_log = []
        while response.stop_reason == "tool_use":
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            tool_results = []

            for tool_use in tool_uses:
                result = await execute_tool(
                    tool_use.name,
                    tool_use.input,
                    current_user,
                    db
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result
                })
                tool_results_log.append({
                    "tool": tool_use.name,
                    "input": tool_use.input,
                    "result": result
                })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system,
                tools=CHAT_TOOLS,
                messages=messages,
            )

        text_content = ""
        for block in response.content:
            if hasattr(block, "text"):
                text_content += block.text

        return ChatResponse(
            message=ChatMessage(role="assistant", content=text_content),
            tool_results=tool_results_log if tool_results_log else None
        )
