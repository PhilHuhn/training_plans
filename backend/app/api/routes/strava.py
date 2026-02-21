from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/strava", tags=["strava"])

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_URL = "https://www.strava.com/api/v3"


@router.get("/auth-url")
async def get_strava_auth_url(current_user: User = Depends(get_current_user)):
    """Get Strava OAuth authorization URL (API endpoint for React SPA)"""
    params = {
        "client_id": settings.STRAVA_CLIENT_ID,
        "redirect_uri": settings.STRAVA_REDIRECT_URI,
        "response_type": "code",
        "scope": "read,activity:read_all",
        "state": str(current_user.id),
    }
    auth_url = f"{STRAVA_AUTH_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    return {"auth_url": auth_url}


@router.get("/callback")
async def strava_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle Strava OAuth callback (GET redirect from Strava)"""
    import httpx

    # Get user from state (user_id)
    try:
        user_id = int(state)
    except ValueError:
        return RedirectResponse(url="/settings?strava=error&reason=invalid_state", status_code=302)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return RedirectResponse(url="/settings?strava=error&reason=user_not_found", status_code=302)

    # Exchange code for tokens
    redirect_uri = f"{settings.BASE_URL}/api/strava/callback"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            },
        )

    if response.status_code != 200:
        return RedirectResponse(url="/settings?strava=error&reason=token_exchange_failed", status_code=302)

    token_data = response.json()

    # Update user with Strava tokens
    user.strava_access_token = token_data["access_token"]
    user.strava_refresh_token = token_data["refresh_token"]
    user.strava_athlete_id = token_data["athlete"]["id"]
    user.strava_token_expires_at = datetime.fromtimestamp(token_data["expires_at"])

    await db.commit()

    return RedirectResponse(url="/settings?strava=connected", status_code=302)


@router.post("/disconnect")
async def disconnect_strava(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Strava account"""
    current_user.strava_access_token = None
    current_user.strava_refresh_token = None
    current_user.strava_athlete_id = None
    current_user.strava_token_expires_at = None

    await db.commit()

    return {"message": "Strava disconnected successfully"}


async def refresh_strava_token(user: User, db: AsyncSession) -> str:
    """Refresh Strava access token if expired"""
    import httpx

    if not user.strava_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strava not connected",
        )

    # Check if token is still valid
    if user.strava_token_expires_at and user.strava_token_expires_at > datetime.utcnow():
        return user.strava_access_token

    # Refresh the token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "refresh_token": user.strava_refresh_token,
                "grant_type": "refresh_token",
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to refresh Strava token",
        )

    token_data = response.json()

    # Update user tokens
    user.strava_access_token = token_data["access_token"]
    user.strava_refresh_token = token_data["refresh_token"]
    user.strava_token_expires_at = datetime.fromtimestamp(token_data["expires_at"])

    await db.commit()

    return user.strava_access_token


@router.post("/sync")
async def sync_activities(
    days_back: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync activities from Strava"""
    from app.services.strava_service import sync_strava_activities, update_user_profile_after_sync

    if not current_user.strava_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strava not connected",
        )

    # Refresh token if needed
    access_token = await refresh_strava_token(current_user, db)

    # Sync activities (90 days for better zone estimation data)
    synced_count = await sync_strava_activities(current_user, access_token, db, days_back=days_back)

    # Update user profile summary after sync
    try:
        await update_user_profile_after_sync(current_user, db)
    except Exception as e:
        print(f"Warning: Failed to update profile summary: {e}")

    return {"message": f"Synced {synced_count} activities from Strava", "count": synced_count}
