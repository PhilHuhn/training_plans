from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from pathlib import Path
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.models.competition import Competition
from app.schemas.competition import CompetitionCreate, CompetitionUpdate, CompetitionResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/competitions", tags=["competitions"])

# Set up templates
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def format_goal_time(seconds: int) -> str:
    """Format goal time in HH:MM:SS"""
    if not seconds:
        return "-"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:02d}"


templates.env.globals["format_goal_time"] = format_goal_time


async def get_competitions_list(user: User, db: AsyncSession, include_past: bool = False):
    """Helper to get competitions for a user"""
    query = select(Competition).where(Competition.user_id == user.id)
    if not include_past:
        query = query.where(Competition.race_date >= date.today())
    query = query.order_by(Competition.race_date)

    result = await db.execute(query)
    competitions = result.scalars().all()

    # Add days_until calculation
    for comp in competitions:
        comp.days_until = (comp.race_date - date.today()).days

    return competitions


def is_htmx_request(request: Request) -> bool:
    """Check if request is from HTMX"""
    return request.headers.get("HX-Request") == "true"


@router.get("", response_model=list[CompetitionResponse])
async def get_competitions(
    include_past: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's competitions"""
    query = select(Competition).where(Competition.user_id == current_user.id)

    if not include_past:
        query = query.where(Competition.race_date >= date.today())

    query = query.order_by(Competition.race_date)

    result = await db.execute(query)
    competitions = result.scalars().all()

    # Calculate days until race
    response_list = []
    for comp in competitions:
        comp_response = CompetitionResponse.model_validate(comp)
        comp_response.days_until = (comp.race_date - date.today()).days
        response_list.append(comp_response)

    return response_list


@router.post("")
async def create_competition(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: Optional[str] = Form(None),
    race_type: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    race_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    goal_time: Optional[int] = Form(None),
    goal_hours: Optional[int] = Form(None),
    goal_minutes: Optional[int] = Form(None),
    goal_seconds: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
):
    """Create a new competition (handles both JSON and form data)"""
    # Check if this is a form submission (HTMX)
    if is_htmx_request(request) or name is not None:
        # Form submission
        from datetime import datetime

        # Calculate goal_time from hours/minutes/seconds if provided
        if goal_hours is not None or goal_minutes is not None or goal_seconds is not None:
            goal_time = (goal_hours or 0) * 3600 + (goal_minutes or 0) * 60 + (goal_seconds or 0)
            if goal_time == 0:
                goal_time = None

        competition = Competition(
            user_id=current_user.id,
            name=name,
            race_type=race_type or "OTHER",
            priority=priority or "B",
            race_date=datetime.strptime(race_date, "%Y-%m-%d").date() if race_date else date.today(),
            location=location or None,
            goal_time=goal_time,
            notes=notes or None,
        )
        db.add(competition)
        await db.commit()

        # Return updated list as HTML partial
        competitions = await get_competitions_list(current_user, db)
        return templates.TemplateResponse(
            "partials/competitions_list.html",
            {"request": request, "competitions": competitions}
        )
    else:
        # JSON API request
        from pydantic import ValidationError

        body = await request.json()
        try:
            competition_data = CompetitionCreate(**body)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors()
            )

        competition = Competition(
            user_id=current_user.id,
            **competition_data.model_dump()
        )
        db.add(competition)
        await db.commit()
        await db.refresh(competition)

        response = CompetitionResponse.model_validate(competition)
        response.days_until = (competition.race_date - date.today()).days
        return response


@router.get("/{competition_id}", response_model=CompetitionResponse)
async def get_competition(
    competition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found"
        )

    response = CompetitionResponse.model_validate(competition)
    response.days_until = (competition.race_date - date.today()).days
    return response


@router.put("/{competition_id}", response_model=CompetitionResponse)
async def update_competition(
    competition_id: int,
    update_data: CompetitionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found"
        )

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(competition, field, value)

    await db.commit()
    await db.refresh(competition)

    response = CompetitionResponse.model_validate(competition)
    response.days_until = (competition.race_date - date.today()).days
    return response


@router.delete("/{competition_id}")
async def delete_competition(
    request: Request,
    competition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found"
        )

    await db.delete(competition)
    await db.commit()

    # If HTMX request, return updated list
    if is_htmx_request(request):
        competitions = await get_competitions_list(current_user, db)
        return templates.TemplateResponse(
            "partials/competitions_list.html",
            {"request": request, "competitions": competitions}
        )

    # Otherwise return 204 No Content
    from fastapi.responses import Response
    return Response(status_code=status.HTTP_204_NO_CONTENT)
