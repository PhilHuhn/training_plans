from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from pathlib import Path

from app.core.config import settings
from app.api.routes import auth, strava, activities, competitions, training, settings as settings_routes, chat, changelog

# App setup
app = FastAPI(
    title=settings.APP_NAME,
    description="Training plan management for runners with AI-powered recommendations",
    version="1.0.0",
)

BASE_DIR = Path(__file__).resolve().parent

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


# ==================== Logout ====================

@app.get("/logout")
async def logout():
    """Logout and clear session cookie"""
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie("access_token")
    return response


# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ==================== SPA Fallback ====================
# Serve React SPA index.html for all non-API routes

_spa_index = BASE_DIR / "static" / "spa" / "index.html"


@app.get("/{path:path}")
async def spa_fallback(path: str):
    """Serve React SPA for client-side routing"""
    # Don't intercept API, static, or health routes
    if path.startswith(("api/", "static/", "assets/", "health")):
        raise HTTPException(status_code=404)
    if not _spa_index.exists():
        # In development, Vite dev server handles frontend routing
        raise HTTPException(
            status_code=404,
            detail="SPA not built. In development, use the Vite dev server at localhost:5173",
        )
    return FileResponse(str(_spa_index))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
