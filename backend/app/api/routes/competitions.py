from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from app.core.database import get_db
from app.models.user import User
from app.models.competition import Competition
from app.schemas.competition import CompetitionCreate, CompetitionUpdate, CompetitionResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/competitions", tags=["competitions"])


@router.get("", response_model=list[CompetitionResponse])
async def get_competitions(
    include_past: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
):
    """Create a new competition (JSON API)"""
    body = await request.json()
    competition_data = CompetitionCreate(**body)

    competition = Competition(
        user_id=current_user.id,
        **competition_data.model_dump(),
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
    db: AsyncSession = Depends(get_db),
):
    """Get a specific competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id,
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found",
        )

    response = CompetitionResponse.model_validate(competition)
    response.days_until = (competition.race_date - date.today()).days
    return response


@router.put("/{competition_id}", response_model=CompetitionResponse)
async def update_competition(
    competition_id: int,
    update_data: CompetitionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id,
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found",
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
    competition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a competition"""
    result = await db.execute(
        select(Competition).where(
            Competition.id == competition_id,
            Competition.user_id == current_user.id,
        )
    )
    competition = result.scalar_one_or_none()

    if not competition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competition not found",
        )

    await db.delete(competition)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
