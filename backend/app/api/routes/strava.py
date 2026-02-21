from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional
import httpx
from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_access_token
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/strava", tags=["strava"])

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_URL = "https://www.strava.com/api/v3"


async def get_user_from_cookie(request: Request, db: AsyncSession) -> Optional[User]:
    """Get user from cookie for browser-based flows"""
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == int(user_id)))
    return result.scalar_one_or_none()


@router.get("/auth")
async def strava_auth_redirect(request: Request, db: AsyncSession = Depends(get_db)):
    """Redirect to Strava OAuth - browser-based flow"""
    user = await get_user_from_cookie(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    # Use BASE_URL for consistent callback URL
    redirect_uri = f"{settings.BASE_URL}/api/strava/callback"
    params = {
        "client_id": settings.STRAVA_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "read,activity:read_all",
        "state": str(user.id),
    }
    auth_url = f"{STRAVA_AUTH_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    print(f"[DEBUG] Strava auth URL: {auth_url}")  # Debug log
    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get("/auth-url")
async def get_strava_auth_url(current_user: User = Depends(get_current_user)):
    """Get Strava OAuth authorization URL (API endpoint)"""
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
async def strava_callback_get(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Handle Strava OAuth callback (GET redirect from Strava)"""
    # Get user from state (user_id)
    try:
        user_id = int(state)
    except ValueError:
        return RedirectResponse(url="/settings?error=invalid_state", status_code=status.HTTP_302_FOUND)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return RedirectResponse(url="/settings?error=user_not_found", status_code=status.HTTP_302_FOUND)

    # Exchange code for tokens
    redirect_uri = f"{settings.BASE_URL}/api/strava/callback"
    print(f"[DEBUG] Token exchange - code: {code[:10]}..., redirect_uri: {redirect_uri}")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            }
        )

    if response.status_code != 200:
        return RedirectResponse(url="/settings?error=token_exchange_failed", status_code=status.HTTP_302_FOUND)

    token_data = response.json()

    # Update user with Strava tokens
    user.strava_access_token = token_data["access_token"]
    user.strava_refresh_token = token_data["refresh_token"]
    user.strava_athlete_id = token_data["athlete"]["id"]
    user.strava_token_expires_at = datetime.fromtimestamp(token_data["expires_at"])

    await db.commit()

    return RedirectResponse(url="/settings?success=strava_connected", status_code=status.HTTP_302_FOUND)


@router.post("/callback")
async def strava_callback_post(
    code: str,
    state: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Handle Strava OAuth callback (API endpoint)"""
    # Verify state matches current user
    if state != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        response = await client.post(
            STRAVA_TOKEN_URL,
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            }
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code for token"
        )

    token_data = response.json()

    # Update user with Strava tokens
    current_user.strava_access_token = token_data["access_token"]
    current_user.strava_refresh_token = token_data["refresh_token"]
    current_user.strava_athlete_id = token_data["athlete"]["id"]
    current_user.strava_token_expires_at = datetime.fromtimestamp(token_data["expires_at"])

    await db.commit()

    return {"message": "Strava connected successfully", "athlete_id": token_data["athlete"]["id"]}


@router.post("/disconnect")
async def disconnect_strava(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
    if not user.strava_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strava not connected"
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
            }
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to refresh Strava token"
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
    request: Request,
    days_back: int = 90,  # Increased default for better zone estimation
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync activities from Strava"""
    from app.services.strava_service import sync_strava_activities, update_user_profile_after_sync
    from fastapi.responses import HTMLResponse

    if not current_user.strava_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strava not connected"
        )

    # Refresh token if needed
    access_token = await refresh_strava_token(current_user, db)

    # Sync activities (90 days for better zone estimation data)
    synced_count = await sync_strava_activities(current_user, access_token, db, days_back=days_back)

    # Update user profile summary after sync (runs in background, non-blocking)
    try:
        await update_user_profile_after_sync(current_user, db)
    except Exception as e:
        # Don't fail the sync if profile generation fails
        print(f"Warning: Failed to update profile summary: {e}")

    # Check if HTMX request - return HTML partial for page refresh
    if request.headers.get("HX-Request") == "true":
        return HTMLResponse(
            f'<div class="p-4 bg-green-50 text-green-700 rounded-md mb-4">'
            f'Successfully synced {synced_count} new activities from Strava!'
            f'</div>'
            f'<script>setTimeout(() => window.location.reload(), 1500)</script>'
        )

    return {"message": f"Synced {synced_count} activities from Strava", "count": synced_count}
