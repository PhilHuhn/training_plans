from fastapi import FastAPI, Request, Depends, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.models.user import User
from app.models.activity import Activity
from app.models.competition import Competition
from app.models.training_session import TrainingSession
from app.api.routes import auth, strava, activities, competitions, training, settings as settings_routes, chat, changelog

# App setup
app = FastAPI(
    title=settings.APP_NAME,
    description="Training plan management for runners with AI-powered recommendations",
    version="1.0.0",
)

# Templates and static files
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Static files (if directory exists)
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Serve React SPA assets in production (built by: cd frontend && npm run build)
spa_dir = BASE_DIR / "static" / "spa"
if spa_dir.exists() and (spa_dir / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(spa_dir / "assets")), name="spa-assets")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api")
app.include_router(strava.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(competitions.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(changelog.router, prefix="/api")


# Template helper functions
def format_duration(seconds: int) -> str:
    """Format seconds into HH:MM:SS or MM:SS"""
    if not seconds:
        return "-"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def format_pace(seconds_per_km: float) -> str:
    """Format pace as M:SS /km"""
    if not seconds_per_km:
        return "-"
    minutes = int(seconds_per_km // 60)
    seconds = int(seconds_per_km % 60)
    return f"{minutes}:{seconds:02d}"


def format_distance(meters: float) -> str:
    """Format distance in km"""
    if not meters:
        return "-"
    km = meters / 1000
    return f"{km:.2f}"


def format_goal_time(seconds: int) -> str:
    """Format goal time in HH:MM:SS"""
    if not seconds:
        return "-"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:02d}"


# Add template globals
templates.env.globals["format_duration"] = format_duration
templates.env.globals["format_pace"] = format_pace
templates.env.globals["formatPace"] = format_pace  # Alias for camelCase usage
templates.env.globals["format_distance"] = format_distance
templates.env.globals["format_goal_time"] = format_goal_time


# Helper to get user from cookie
async def get_current_user_from_cookie(request: Request, db: AsyncSession) -> Optional[User]:
    """Get current user from session cookie"""
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


def require_auth(redirect_url: str = "/login"):
    """Decorator to require authentication for routes"""
    async def dependency(request: Request, db: AsyncSession = Depends(get_db)):
        user = await get_current_user_from_cookie(request, db)
        if not user:
            return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
        return user
    return dependency


# ==================== HTML Routes ====================

@app.get("/", response_class=HTMLResponse)
async def home(request: Request, db: AsyncSession = Depends(get_db)):
    """Home page - redirect to dashboard if logged in, otherwise to login"""
    user = await get_current_user_from_cookie(request, db)
    if user:
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, db: AsyncSession = Depends(get_db)):
    """Login page"""
    user = await get_current_user_from_cookie(request, db)
    if user:
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse("auth/login.html", {"request": request})


@app.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Handle login form submission"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": "Invalid email or password"}
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    response = RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax"
    )
    return response


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request, db: AsyncSession = Depends(get_db)):
    """Registration page"""
    user = await get_current_user_from_cookie(request, db)
    if user:
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse("auth/register.html", {"request": request})


@app.post("/register", response_class=HTMLResponse)
async def register_submit(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Handle registration form submission"""
    if password != confirm_password:
        return templates.TemplateResponse(
            "auth/register.html",
            {"request": request, "error": "Passwords do not match"}
        )

    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        return templates.TemplateResponse(
            "auth/register.html",
            {"request": request, "error": "Email already registered"}
        )

    # Create user
    user = User(
        email=email,
        name=name,
        password_hash=get_password_hash(password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Log user in
    access_token = create_access_token(data={"sub": str(user.id)})
    response = RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax"
    )
    return response


@app.get("/logout")
async def logout():
    """Logout and clear session"""
    response = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("access_token")
    return response


# ==================== Dashboard Routes ====================

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, week: str = None, db: AsyncSession = Depends(get_db)):
    """Dashboard / Training page"""
    user = await get_current_user_from_cookie(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    # Get current week's sessions
    today = date.today()

    # Allow navigating to different weeks via query param
    if week:
        try:
            week_start = date.fromisoformat(week)
        except ValueError:
            week_start = today - timedelta(days=today.weekday())
    else:
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    # Generate list of days for the week
    week_days = [week_start + timedelta(days=i) for i in range(7)]

    # Previous/next week for navigation
    prev_week = (week_start - timedelta(days=7)).isoformat()
    next_week = (week_start + timedelta(days=7)).isoformat()

    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.user_id == user.id)
        .where(TrainingSession.session_date >= week_start)
        .where(TrainingSession.session_date <= week_end)
        .order_by(TrainingSession.session_date)
    )
    sessions = result.scalars().all()

    # Create dict mapping date strings to sessions for template lookup
    sessions_by_date = {
        s.session_date.isoformat(): s for s in sessions
    }

    # Calculate totals for the week (distance and time)
    total_planned = sum(
        (s.planned_workout or {}).get("distance_km", 0) or 0
        for s in sessions
    )
    total_recommended = sum(
        (s.recommendation_workout or {}).get("distance_km", 0) or 0
        for s in sessions
    )
    total_final = sum(
        (s.final_workout or {}).get("distance_km", 0) or 0
        for s in sessions
    )

    # Time totals (in minutes)
    total_planned_time = sum(
        (s.planned_workout or {}).get("duration_min", 0) or 0
        for s in sessions
    )
    total_recommended_time = sum(
        (s.recommendation_workout or {}).get("duration_min", 0) or 0
        for s in sessions
    )
    total_final_time = sum(
        (s.final_workout or {}).get("duration_min", 0) or 0
        for s in sessions
    )

    # Get upcoming competition
    result = await db.execute(
        select(Competition)
        .where(Competition.user_id == user.id)
        .where(Competition.race_date >= today)
        .order_by(Competition.race_date)
        .limit(1)
    )
    next_competition = result.scalar_one_or_none()

    return templates.TemplateResponse(
        "dashboard/training.html",
        {
            "request": request,
            "user": user,
            "sessions": sessions,
            "sessions_by_date": sessions_by_date,
            "week_days": week_days,
            "week_start": week_start,
            "week_end": week_end,
            "prev_week": prev_week,
            "next_week": next_week,
            "today": today.isoformat(),  # String for template comparison
            "next_competition": next_competition,
            "total_planned": total_planned,
            "total_recommended": total_recommended,
            "total_final": total_final,
            "total_planned_time": total_planned_time,
            "total_recommended_time": total_recommended_time,
            "total_final_time": total_final_time,
        }
    )


@app.get("/training", response_class=HTMLResponse)
async def training_page(request: Request, week: str = None, db: AsyncSession = Depends(get_db)):
    """Training page (alias for dashboard)"""
    return await dashboard(request, week, db)


@app.get("/activities", response_class=HTMLResponse)
async def activities_page(request: Request, db: AsyncSession = Depends(get_db)):
    """Activities page"""
    user = await get_current_user_from_cookie(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    # Get recent activities
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user.id)
        .order_by(Activity.start_date.desc())
        .limit(50)
    )
    activities_list = result.scalars().all()

    # Calculate stats
    from sqlalchemy import func
    stats_result = await db.execute(
        select(
            func.count(Activity.id).label("total_activities"),
            func.sum(Activity.distance).label("total_distance"),
            func.sum(Activity.duration).label("total_duration"),
        ).where(Activity.user_id == user.id)
    )
    stats = stats_result.one()

    return templates.TemplateResponse(
        "dashboard/activities.html",
        {
            "request": request,
            "user": user,
            "activities": activities_list,
            "total_activities": stats.total_activities or 0,
            "total_distance": (stats.total_distance or 0) / 1000,  # Convert to km
            "total_duration": (stats.total_duration or 0) / 3600,  # Convert to hours
        }
    )


@app.get("/competitions", response_class=HTMLResponse)
async def competitions_page(request: Request, db: AsyncSession = Depends(get_db)):
    """Competitions page"""
    user = await get_current_user_from_cookie(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    # Get competitions
    result = await db.execute(
        select(Competition)
        .where(Competition.user_id == user.id)
        .where(Competition.race_date >= date.today())
        .order_by(Competition.race_date)
    )
    competitions_list = result.scalars().all()

    # Add days_until calculation
    for comp in competitions_list:
        comp.days_until = (comp.race_date - date.today()).days

    return templates.TemplateResponse(
        "dashboard/competitions.html",
        {
            "request": request,
            "user": user,
            "competitions": competitions_list,
        }
    )


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, db: AsyncSession = Depends(get_db)):
    """Settings page"""
    user = await get_current_user_from_cookie(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

    return templates.TemplateResponse(
        "dashboard/settings.html",
        {
            "request": request,
            "user": user,
        }
    )


# ==================== HTMX Partial Endpoints ====================

@app.get("/partials/competitions-list", response_class=HTMLResponse)
async def competitions_list_partial(request: Request, db: AsyncSession = Depends(get_db)):
    """Partial for competitions list (used by HTMX after mutations)"""
    user = await get_current_user_from_cookie(request, db)
    if not user:
        return HTMLResponse(content="Unauthorized", status_code=401)

    result = await db.execute(
        select(Competition)
        .where(Competition.user_id == user.id)
        .where(Competition.race_date >= date.today())
        .order_by(Competition.race_date)
    )
    competitions_list = result.scalars().all()

    for comp in competitions_list:
        comp.days_until = (comp.race_date - date.today()).days

    return templates.TemplateResponse(
        "partials/competitions_list.html",
        {
            "request": request,
            "competitions": competitions_list,
        }
    )


# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# ==================== SPA Fallback ====================
# Serve React SPA index.html for all non-API routes (production only)
_spa_index = BASE_DIR / "static" / "spa" / "index.html"
if _spa_index.exists():
    from fastapi.responses import FileResponse

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        """Serve React SPA for client-side routing"""
        # Don't intercept API, static, or health routes
        if path.startswith(("api/", "static/", "assets/", "health")):
            raise HTTPException(status_code=404)
        return FileResponse(str(_spa_index))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
