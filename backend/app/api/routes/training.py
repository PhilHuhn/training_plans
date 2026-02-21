from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import date, timedelta
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.models.training_session import TrainingSession, UploadedPlan, SessionStatus, SessionSource
from app.schemas.training import (
    TrainingSessionCreate,
    TrainingSessionUpdate,
    TrainingSessionResponse,
    TrainingWeekResponse,
    GenerateRecommendationsRequest,
    ConvertSessionRequest,
    UploadPlanResponse,
)
from app.api.deps import get_current_user
from app.services.training_engine import (
    generate_recommendations,
    convert_session,
    save_recommendations,
)
from app.services.document_parser import process_uploaded_plan

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/sessions", response_model=list[TrainingSessionResponse])
async def get_training_sessions(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get training sessions for a date range"""
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date + timedelta(days=14)

    query = (
        select(TrainingSession)
        .where(TrainingSession.user_id == current_user.id)
        .where(TrainingSession.session_date >= start_date)
        .where(TrainingSession.session_date <= end_date)
        .order_by(TrainingSession.session_date)
    )

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [TrainingSessionResponse.model_validate(s) for s in sessions]


@router.get("/sessions/week", response_model=TrainingWeekResponse)
async def get_training_week(
    week_start: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get training sessions for a specific week (Monday-Sunday)"""
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    query = (
        select(TrainingSession)
        .where(TrainingSession.user_id == current_user.id)
        .where(TrainingSession.session_date >= week_start)
        .where(TrainingSession.session_date <= week_end)
        .order_by(TrainingSession.session_date)
    )

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Calculate totals
    total_planned = sum(
        (s.planned_workout or {}).get("distance_km", 0) or 0 for s in sessions
    )
    total_recommended = sum(
        (s.recommendation_workout or {}).get("distance_km", 0) or 0 for s in sessions
    )

    return TrainingWeekResponse(
        sessions=[TrainingSessionResponse.model_validate(s) for s in sessions],
        week_start=week_start,
        week_end=week_end,
        total_distance_planned=total_planned,
        total_distance_recommended=total_recommended,
    )


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_training_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new training session (JSON API)"""
    body = await request.json()
    session_data = TrainingSessionCreate(**body)

    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.user_id == current_user.id)
        .where(TrainingSession.session_date == session_data.session_date)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already exists for this date. Use PUT to update.",
        )

    session = TrainingSession(
        user_id=current_user.id,
        session_date=session_data.session_date,
        source=session_data.source,
        planned_workout=session_data.planned_workout.model_dump() if session_data.planned_workout else None,
        recommendation_workout=session_data.recommendation_workout.model_dump() if session_data.recommendation_workout else None,
        notes=session_data.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return TrainingSessionResponse.model_validate(session)


@router.put("/sessions/{session_id}")
async def update_training_session(
    session_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a training session (JSON API)"""
    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.id == session_id)
        .where(TrainingSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found",
        )

    body = await request.json()
    update_data = TrainingSessionUpdate(**body)

    if update_data.planned_workout is not None:
        session.planned_workout = update_data.planned_workout.model_dump()
    if update_data.recommendation_workout is not None:
        session.recommendation_workout = update_data.recommendation_workout.model_dump()
    if update_data.status is not None:
        session.status = update_data.status
    if update_data.notes is not None:
        session.notes = update_data.notes

    await db.commit()
    await db.refresh(session)

    return TrainingSessionResponse.model_validate(session)


@router.delete("/sessions/{session_id}")
async def delete_training_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a training session"""
    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.id == session_id)
        .where(TrainingSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found",
        )

    await db.delete(session)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_id}/accept")
async def accept_workout(
    session_id: int,
    source: str,  # "planned" or "ai"
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a workout from either the planned or AI recommendation"""
    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.id == session_id)
        .where(TrainingSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found",
        )

    if source == "planned":
        if not session.planned_workout:
            raise HTTPException(status_code=400, detail="No planned workout to accept")
        session.final_workout = session.planned_workout
        session.accepted_source = "planned"
    elif source == "ai":
        if not session.recommendation_workout:
            raise HTTPException(status_code=400, detail="No AI recommendation to accept")
        session.final_workout = session.recommendation_workout
        session.accepted_source = "ai"
    else:
        raise HTTPException(status_code=400, detail="Invalid source. Use 'planned' or 'ai'")

    await db.commit()
    await db.refresh(session)

    return {"success": True, "accepted_source": source}


@router.post("/generate-recommendations")
async def generate_training_recommendations(
    request: Request,
    start_date: date = Query(None),
    end_date: date = Query(None),
    consider_uploaded_plan: bool = Query(True),
    include_cross_training: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI training recommendations for a date range."""
    from app.models.competition import Competition
    import traceback

    MAX_WEEKS = 16

    try:
        if start_date is None:
            start_date = date.today()

        if end_date is None:
            comp_result = await db.execute(
                select(Competition)
                .where(Competition.user_id == current_user.id)
                .where(Competition.race_date >= start_date)
                .order_by(Competition.race_date.desc())
                .limit(1)
            )
            last_competition = comp_result.scalar_one_or_none()

            max_end_date = start_date + timedelta(weeks=MAX_WEEKS)

            if last_competition and last_competition.race_date <= max_end_date:
                end_date = last_competition.race_date + timedelta(days=3)
            else:
                end_date = max_end_date

        result = await generate_recommendations(
            user=current_user,
            db=db,
            start_date=start_date,
            end_date=end_date,
            consider_fixed_plan=consider_uploaded_plan,
            include_cross_training=include_cross_training,
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"],
            )

        # Save recommendations to database
        await save_recommendations(current_user, db, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Exception in generate-recommendations: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/convert-session")
async def convert_training_session(
    request: ConvertSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """Convert a session between pace-based and HR-based formats"""
    result = await convert_session(
        user=current_user,
        workout=request.workout.model_dump(),
        target_type=request.target_type,
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["error"],
        )

    return result


@router.post("/upload-plan")
async def upload_training_plan(
    file: UploadFile = File(...),
    start_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a training plan document (PDF, Word, or text file)"""
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
    ]

    if file.content_type not in allowed_types and not file.filename.endswith(
        (".pdf", ".docx", ".doc", ".txt", ".md")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: PDF, Word, TXT, Markdown",
        )

    # Read file content
    file_content = await file.read()

    if len(file_content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB.",
        )

    try:
        uploaded_plan = await process_uploaded_plan(
            user=current_user,
            db=db,
            file_content=file_content,
            content_type=file.content_type or "",
            filename=file.filename or "unknown",
            start_date=start_date,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return UploadPlanResponse(
        id=uploaded_plan.id,
        filename=uploaded_plan.filename,
        is_active=bool(uploaded_plan.is_active),
        parsed_sessions_count=len(uploaded_plan.parsed_sessions or []),
        upload_date=uploaded_plan.upload_date,
    )


@router.get("/uploaded-plans", response_model=list[UploadPlanResponse])
async def get_uploaded_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all uploaded training plans"""
    result = await db.execute(
        select(UploadedPlan)
        .where(UploadedPlan.user_id == current_user.id)
        .order_by(desc(UploadedPlan.upload_date))
    )
    plans = result.scalars().all()

    return [
        UploadPlanResponse(
            id=p.id,
            filename=p.filename,
            is_active=bool(p.is_active),
            parsed_sessions_count=len(p.parsed_sessions or []),
            upload_date=p.upload_date,
        )
        for p in plans
    ]


@router.delete("/uploaded-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_uploaded_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded plan and its associated sessions"""
    result = await db.execute(
        select(UploadedPlan)
        .where(UploadedPlan.id == plan_id)
        .where(UploadedPlan.user_id == current_user.id)
    )
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded plan not found",
        )

    # Delete associated sessions
    await db.execute(
        select(TrainingSession).where(TrainingSession.uploaded_plan_id == plan_id)
    )

    await db.delete(plan)
    await db.commit()


@router.get("/sessions/{session_id}/export/garmin")
async def export_session_to_garmin(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a training session as a Garmin FIT workout file."""
    from app.services.garmin_export import (
        create_fit_workout,
        workout_details_to_structured,
        FIT_AVAILABLE,
    )
    from app.schemas.training import WorkoutDetails

    if not FIT_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="FIT file export not available. Install fit-tool library.",
        )

    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.id == session_id)
        .where(TrainingSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found",
        )

    # Determine which workout to export (prefer final, then planned, then AI)
    workout_data = session.final_workout or session.planned_workout or session.recommendation_workout
    if not workout_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workout data available for export",
        )

    workout = WorkoutDetails(**workout_data)
    structured = workout_details_to_structured(workout, session.session_date)
    user_prefs = current_user.preferences or {}

    try:
        fit_bytes = create_fit_workout(structured, user_prefs)

        date_str = session.session_date.strftime("%Y%m%d")
        workout_type = workout.type.replace("_", "-")
        filename = f"{date_str}_{workout_type}.fit"

        return Response(
            content=fit_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(fit_bytes)),
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create FIT file: {str(e)}",
        )
