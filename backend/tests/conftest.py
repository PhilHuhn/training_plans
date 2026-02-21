"""
Pytest fixtures for testing the Turbine Turmweg Training backend.
"""
import os
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from datetime import datetime, date, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

# Set test environment before importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["STRAVA_CLIENT_ID"] = "test_strava_id"
os.environ["STRAVA_CLIENT_SECRET"] = "test_strava_secret"
os.environ["ANTHROPIC_API_KEY"] = "test_anthropic_key"

from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.activity import Activity
from app.models.competition import Competition, RaceType, RacePriority
from app.models.training_session import TrainingSession, SessionSource, SessionStatus, UploadedPlan
from app.models.zone_history import ZoneHistory
from main import app


# Create test engine with in-memory SQLite
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash=get_password_hash("password123"),
        preferences={
            "units": "metric",
            "hr_zones": {
                "zone1": {"min": 0, "max": 130, "name": "Recovery"},
                "zone2": {"min": 130, "max": 150, "name": "Aerobic"},
                "zone3": {"min": 150, "max": 165, "name": "Tempo"},
                "zone4": {"min": 165, "max": 180, "name": "Threshold"},
                "zone5": {"min": 180, "max": 220, "name": "VO2max"}
            },
            "pace_zones": {
                "easy": {"min": 330, "max": 390, "name": "Easy"},
                "moderate": {"min": 300, "max": 330, "name": "Moderate"},
                "tempo": {"min": 270, "max": 300, "name": "Tempo"},
                "threshold": {"min": 250, "max": 270, "name": "Threshold"},
                "interval": {"min": 210, "max": 250, "name": "Interval"}
            },
            "max_hr": 190,
            "resting_hr": 50
        }
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_user_with_strava(db: AsyncSession) -> User:
    """Create a test user with Strava connection."""
    user = User(
        email="strava@example.com",
        name="Strava User",
        password_hash=get_password_hash("password123"),
        strava_access_token="test_access_token",
        strava_refresh_token="test_refresh_token",
        strava_athlete_id=12345,
        strava_token_expires_at=datetime.now() + timedelta(hours=6),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: User) -> str:
    """Create an authentication token for the test user."""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Create authentication headers."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def auth_cookies(auth_token: str) -> dict:
    """Create authentication cookies."""
    return {"access_token": auth_token}


@pytest.fixture
async def test_activity(db: AsyncSession, test_user: User) -> Activity:
    """Create a test activity."""
    activity = Activity(
        user_id=test_user.id,
        strava_id="12345678",
        name="Morning Run",
        activity_type="Run",
        distance=10000.0,  # 10 km
        duration=3600,  # 1 hour
        avg_heart_rate=145.0,
        max_heart_rate=175.0,
        avg_pace=360.0,  # 6:00 min/km
        elevation_gain=100.0,
        start_date=datetime.now() - timedelta(days=1),
        start_date_local=datetime.now() - timedelta(days=1),
        raw_data={"type": "Run", "name": "Morning Run"},
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@pytest.fixture
async def test_activities(db: AsyncSession, test_user: User) -> list[Activity]:
    """Create multiple test activities."""
    activities = []
    for i in range(5):
        activity = Activity(
            user_id=test_user.id,
            strava_id=f"activity_{i}",
            name=f"Run {i+1}",
            activity_type="Run",
            distance=5000.0 + i * 1000,
            duration=1800 + i * 300,
            avg_heart_rate=140.0 + i * 5,
            max_heart_rate=170.0 + i * 3,
            avg_pace=360.0 - i * 10,
            elevation_gain=50.0 + i * 20,
            start_date=datetime.now() - timedelta(days=i+1),
            start_date_local=datetime.now() - timedelta(days=i+1),
        )
        db.add(activity)
        activities.append(activity)

    await db.commit()
    for activity in activities:
        await db.refresh(activity)
    return activities


@pytest.fixture
async def test_competition(db: AsyncSession, test_user: User) -> Competition:
    """Create a test competition."""
    competition = Competition(
        user_id=test_user.id,
        name="City Marathon",
        race_type=RaceType.MARATHON,
        distance=42195.0,
        race_date=date.today() + timedelta(days=90),
        goal_time=12600,  # 3:30:00
        goal_pace=299,  # ~5:00 min/km
        priority=RacePriority.A,
        location="Berlin",
        notes="Goal race for the year",
    )
    db.add(competition)
    await db.commit()
    await db.refresh(competition)
    return competition


@pytest.fixture
async def test_competitions(db: AsyncSession, test_user: User) -> list[Competition]:
    """Create multiple test competitions."""
    competitions = [
        Competition(
            user_id=test_user.id,
            name="10K Race",
            race_type=RaceType.TEN_K,
            distance=10000.0,
            race_date=date.today() + timedelta(days=30),
            goal_time=2700,  # 45:00
            priority=RacePriority.B,
        ),
        Competition(
            user_id=test_user.id,
            name="Half Marathon",
            race_type=RaceType.HALF_MARATHON,
            distance=21097.5,
            race_date=date.today() + timedelta(days=60),
            goal_time=5400,  # 1:30:00
            priority=RacePriority.A,
        ),
    ]
    for comp in competitions:
        db.add(comp)
    await db.commit()
    for comp in competitions:
        await db.refresh(comp)
    return competitions


@pytest.fixture
async def test_training_session(db: AsyncSession, test_user: User) -> TrainingSession:
    """Create a test training session."""
    session = TrainingSession(
        user_id=test_user.id,
        session_date=date.today(),
        source=SessionSource.MANUAL,
        status=SessionStatus.PLANNED,
        planned_workout={
            "type": "Easy Run",
            "description": "Easy recovery run",
            "distance_km": 8.0,
            "duration_min": 50,
            "intensity": "easy",
            "hr_zone": "Zone 2",
        },
        recommendation_workout={
            "type": "Recovery",
            "description": "Light jog or rest day",
            "distance_km": 5.0,
            "duration_min": 35,
            "intensity": "recovery",
            "hr_zone": "Zone 1",
        },
        accepted_source="none",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@pytest.fixture
async def test_uploaded_plan(db: AsyncSession, test_user: User) -> UploadedPlan:
    """Create a test uploaded plan."""
    plan = UploadedPlan(
        user_id=test_user.id,
        filename="training_plan.pdf",
        content_type="application/pdf",
        content_text="Week 1: Easy run 5k, Long run 15k...",
        parsed_sessions=[
            {"date": "2024-01-15", "type": "Easy Run", "distance_km": 5.0},
            {"date": "2024-01-21", "type": "Long Run", "distance_km": 15.0},
        ],
        is_active=1,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@pytest.fixture
async def test_zone_history(db: AsyncSession, test_user: User) -> ZoneHistory:
    """Create a test zone history entry."""
    zone_history = ZoneHistory(
        user_id=test_user.id,
        source="strava_estimate",
        activities_analyzed=50,
        date_range_start=datetime.now() - timedelta(days=90),
        date_range_end=datetime.now(),
        max_hr=190,
        resting_hr=50,
        hr_zones={
            "zone1": {"min": 100, "max": 130},
            "zone2": {"min": 130, "max": 150},
            "zone3": {"min": 150, "max": 165},
            "zone4": {"min": 165, "max": 180},
            "zone5": {"min": 180, "max": 190},
        },
        pace_zones={
            "easy": {"min": 330, "max": 390},
            "moderate": {"min": 300, "max": 330},
            "tempo": {"min": 270, "max": 300},
        },
        avg_hr_easy_runs=135.0,
        avg_pace_easy_runs=360.0,
    )
    db.add(zone_history)
    await db.commit()
    await db.refresh(zone_history)
    return zone_history
