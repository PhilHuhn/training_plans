from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


# Find .env file - check backend dir first, then project root
def find_env_file() -> str:
    current = Path(__file__).resolve().parent.parent.parent  # backend/
    if (current / ".env").exists():
        return str(current / ".env")
    root = current.parent  # project root
    if (root / ".env").exists():
        return str(root / ".env")
    return ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Turbine Turmweg Training"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production

    # Database - supports SQLite for local dev, PostgreSQL for production
    # Default to SQLite for easy local development
    DATABASE_URL: str = "sqlite:///./turbine_turmweg.db"

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database"""
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def async_database_url(self) -> str:
        """Convert DATABASE_URL to async version for SQLAlchemy"""
        url = self.DATABASE_URL

        # Handle SQLite
        if url.startswith("sqlite"):
            if "+aiosqlite" not in url:
                url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
            return url

        # Render uses postgres://, SQLAlchemy needs postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        # Add asyncpg driver if not present
        if "postgresql://" in url and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Strava
    STRAVA_CLIENT_ID: str = ""
    STRAVA_CLIENT_SECRET: str = ""

    @property
    def STRAVA_REDIRECT_URI(self) -> str:
        """Dynamic redirect URI based on environment"""
        if self.RENDER_EXTERNAL_URL:
            return f"{self.RENDER_EXTERNAL_URL}/api/strava/callback"
        return f"{self.BASE_URL}/api/strava/callback"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # URLs
    BASE_URL: str = "http://localhost:8000"
    RENDER_EXTERNAL_URL: str = ""  # Set automatically by Render

    # CORS
    @property
    def CORS_ORIGINS(self) -> list[str]:
        origins = [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        if self.RENDER_EXTERNAL_URL:
            origins.append(self.RENDER_EXTERNAL_URL)
        return origins

    class Config:
        env_file = find_env_file()
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars from Render


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
