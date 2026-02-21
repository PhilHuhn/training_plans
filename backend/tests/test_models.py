"""
Tests for SQLAlchemy models.
"""
import pytest
from datetime import datetime, date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.activity import Activity
from app.models.competition import Competition, RaceType, RacePriority
from app.models.training_session import TrainingSession, UploadedPlan, SessionSource, SessionStatus
from app.models.zone_history import ZoneHistory
from app.core.security import get_password_hash, verify_password


class TestUserModel:
    """Tests for the User model."""

    async def test_create_user(self, db: AsyncSession):
        """Test creating a user."""
        user = User(
            email="new@example.com",
            name="New User",
            password_hash=get_password_hash("password123"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        assert user.id is not None
        assert user.email == "new@example.com"
        assert user.name == "New User"
        assert user.created_at is not None

    async def test_user_password_verification(self, test_user: User):
        """Test password verification."""
        assert verify_password("password123", test_user.password_hash)
        assert not verify_password("wrongpassword", test_user.password_hash)

    async def test_user_default_preferences(self, db: AsyncSession):
        """Test that user has default preferences."""
        user = User(
            email="prefs@example.com",
            name="Prefs User",
            password_hash=get_password_hash("password123"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        assert user.preferences is not None
        assert "units" in user.preferences
        assert "hr_zones" in user.preferences
        assert "pace_zones" in user.preferences

    async def test_user_unique_email(self, db: AsyncSession, test_user: User):
        """Test that email must be unique."""
        from sqlalchemy.exc import IntegrityError

        duplicate_user = User(
            email=test_user.email,
            name="Duplicate",
            password_hash=get_password_hash("password"),
        )
        db.add(duplicate_user)

        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_user_strava_integration(self, test_user_with_strava: User):
        """Test user with Strava integration."""
        assert test_user_with_strava.strava_access_token is not None
        assert test_user_with_strava.strava_refresh_token is not None
        assert test_user_with_strava.strava_athlete_id == 12345


class TestActivityModel:
    """Tests for the Activity model."""

    async def test_create_activity(self, db: AsyncSession, test_user: User):
        """Test creating an activity."""
        activity = Activity(
            user_id=test_user.id,
            strava_id="new_activity_123",
            name="Test Run",
            activity_type="Run",
            distance=5000.0,
            duration=1800,
            start_date=datetime.now(),
        )
        db.add(activity)
        await db.commit()
        await db.refresh(activity)

        assert activity.id is not None
        assert activity.user_id == test_user.id
        assert activity.distance == 5000.0

    async def test_activity_relationship(self, db: AsyncSession, test_activity: Activity):
        """Test activity-user relationship."""
        result = await db.execute(
            select(Activity).where(Activity.id == test_activity.id)
        )
        activity = result.scalar_one()

        # Load user relationship
        await db.refresh(activity, ["user"])
        assert activity.user is not None
        assert activity.user.email == "test@example.com"

    async def test_activity_pace_calculation(self, test_activity: Activity):
        """Test that pace is stored correctly."""
        assert test_activity.avg_pace == 360.0  # 6:00 min/km

    async def test_activity_heart_rate_data(self, test_activity: Activity):
        """Test heart rate data storage."""
        assert test_activity.avg_heart_rate == 145.0
        assert test_activity.max_heart_rate == 175.0


class TestCompetitionModel:
    """Tests for the Competition model."""

    async def test_create_competition(self, db: AsyncSession, test_user: User):
        """Test creating a competition."""
        competition = Competition(
            user_id=test_user.id,
            name="Test Race",
            race_type=RaceType.TEN_K,
            distance=10000.0,
            race_date=date.today() + timedelta(days=30),
            goal_time=2700,
            priority=RacePriority.B,
        )
        db.add(competition)
        await db.commit()
        await db.refresh(competition)

        assert competition.id is not None
        assert competition.race_type == RaceType.TEN_K
        assert competition.priority == RacePriority.B

    async def test_competition_race_types(self, db: AsyncSession, test_user: User):
        """Test various race types."""
        race_types = [
            RaceType.FIVE_K,
            RaceType.TEN_K,
            RaceType.HALF_MARATHON,
            RaceType.MARATHON,
            RaceType.ULTRA_50K,
        ]

        for race_type in race_types:
            competition = Competition(
                user_id=test_user.id,
                name=f"{race_type.value} Race",
                race_type=race_type,
                race_date=date.today() + timedelta(days=30),
            )
            db.add(competition)

        await db.commit()

        result = await db.execute(
            select(Competition).where(Competition.user_id == test_user.id)
        )
        competitions = result.scalars().all()
        assert len(competitions) == len(race_types)

    async def test_competition_priorities(self, db: AsyncSession, test_user: User):
        """Test race priority enum."""
        for priority in RacePriority:
            competition = Competition(
                user_id=test_user.id,
                name=f"Priority {priority.value} Race",
                race_type=RaceType.TEN_K,
                race_date=date.today() + timedelta(days=30),
                priority=priority,
            )
            db.add(competition)

        await db.commit()

        result = await db.execute(
            select(Competition).where(Competition.user_id == test_user.id)
        )
        competitions = result.scalars().all()
        priorities = {c.priority for c in competitions}
        assert priorities == {RacePriority.A, RacePriority.B, RacePriority.C}


class TestTrainingSessionModel:
    """Tests for the TrainingSession model."""

    async def test_create_training_session(self, db: AsyncSession, test_user: User):
        """Test creating a training session."""
        session = TrainingSession(
            user_id=test_user.id,
            session_date=date.today(),
            source=SessionSource.MANUAL,
            status=SessionStatus.PLANNED,
            planned_workout={"type": "Easy Run", "distance_km": 5.0},
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        assert session.id is not None
        assert session.source == SessionSource.MANUAL
        assert session.status == SessionStatus.PLANNED

    async def test_training_session_workout_data(self, test_training_session: TrainingSession):
        """Test workout JSON storage."""
        assert test_training_session.planned_workout is not None
        assert test_training_session.planned_workout["type"] == "Easy Run"
        assert test_training_session.planned_workout["distance_km"] == 8.0

    async def test_training_session_recommendation(self, test_training_session: TrainingSession):
        """Test recommendation workout storage."""
        assert test_training_session.recommendation_workout is not None
        assert test_training_session.recommendation_workout["type"] == "Recovery"

    async def test_training_session_statuses(self, db: AsyncSession, test_user: User):
        """Test session status transitions."""
        session = TrainingSession(
            user_id=test_user.id,
            session_date=date.today(),
            source=SessionSource.MANUAL,
            status=SessionStatus.PLANNED,
        )
        db.add(session)
        await db.commit()

        # Update to completed
        session.status = SessionStatus.COMPLETED
        await db.commit()
        await db.refresh(session)

        assert session.status == SessionStatus.COMPLETED

    async def test_training_session_accepted_source(self, db: AsyncSession, test_user: User):
        """Test accepting a workout source."""
        session = TrainingSession(
            user_id=test_user.id,
            session_date=date.today(),
            source=SessionSource.MANUAL,
            status=SessionStatus.PLANNED,
            planned_workout={"type": "Tempo", "distance_km": 10.0},
            recommendation_workout={"type": "Easy", "distance_km": 8.0},
            accepted_source="none",
        )
        db.add(session)
        await db.commit()

        # Accept planned workout
        session.accepted_source = "planned"
        session.final_workout = session.planned_workout
        await db.commit()
        await db.refresh(session)

        assert session.accepted_source == "planned"
        assert session.final_workout["type"] == "Tempo"


class TestUploadedPlanModel:
    """Tests for the UploadedPlan model."""

    async def test_create_uploaded_plan(self, db: AsyncSession, test_user: User):
        """Test creating an uploaded plan."""
        plan = UploadedPlan(
            user_id=test_user.id,
            filename="my_plan.pdf",
            content_type="application/pdf",
            content_text="Training plan content...",
            is_active=1,
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)

        assert plan.id is not None
        assert plan.filename == "my_plan.pdf"
        assert plan.is_active == 1

    async def test_uploaded_plan_parsed_sessions(self, test_uploaded_plan: UploadedPlan):
        """Test parsed sessions JSON storage."""
        assert test_uploaded_plan.parsed_sessions is not None
        assert len(test_uploaded_plan.parsed_sessions) == 2
        assert test_uploaded_plan.parsed_sessions[0]["type"] == "Easy Run"

    async def test_uploaded_plan_user_relationship(
        self, db: AsyncSession, test_uploaded_plan: UploadedPlan
    ):
        """Test plan-user relationship."""
        await db.refresh(test_uploaded_plan, ["user"])
        assert test_uploaded_plan.user is not None


class TestZoneHistoryModel:
    """Tests for the ZoneHistory model."""

    async def test_create_zone_history(self, db: AsyncSession, test_user: User):
        """Test creating a zone history entry."""
        zone_history = ZoneHistory(
            user_id=test_user.id,
            source="manual",
            max_hr=185,
            resting_hr=48,
            hr_zones={"zone1": {"min": 100, "max": 130}},
        )
        db.add(zone_history)
        await db.commit()
        await db.refresh(zone_history)

        assert zone_history.id is not None
        assert zone_history.source == "manual"
        assert zone_history.calculated_at is not None

    async def test_zone_history_data(self, test_zone_history: ZoneHistory):
        """Test zone history data storage."""
        assert test_zone_history.activities_analyzed == 50
        assert test_zone_history.max_hr == 190
        assert test_zone_history.hr_zones is not None
        assert "zone1" in test_zone_history.hr_zones


class TestModelRelationships:
    """Tests for cross-model relationships."""

    async def test_user_activities_cascade(self, db: AsyncSession, test_user: User, test_activity: Activity):
        """Test that deleting user cascades to activities."""
        user_id = test_user.id
        activity_id = test_activity.id

        await db.delete(test_user)
        await db.commit()

        # Activity should be deleted too
        result = await db.execute(select(Activity).where(Activity.id == activity_id))
        assert result.scalar_one_or_none() is None

    async def test_user_competitions_cascade(
        self, db: AsyncSession, test_user: User, test_competition: Competition
    ):
        """Test that deleting user cascades to competitions."""
        competition_id = test_competition.id

        await db.delete(test_user)
        await db.commit()

        result = await db.execute(select(Competition).where(Competition.id == competition_id))
        assert result.scalar_one_or_none() is None

    async def test_user_training_sessions_cascade(
        self, db: AsyncSession, test_user: User, test_training_session: TrainingSession
    ):
        """Test that deleting user cascades to training sessions."""
        session_id = test_training_session.id

        await db.delete(test_user)
        await db.commit()

        result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
        assert result.scalar_one_or_none() is None

    async def test_training_session_activity_link(
        self, db: AsyncSession, test_user: User, test_activity: Activity
    ):
        """Test linking a completed activity to a training session."""
        session = TrainingSession(
            user_id=test_user.id,
            session_date=test_activity.start_date.date(),
            source=SessionSource.MANUAL,
            status=SessionStatus.COMPLETED,
            completed_activity_id=test_activity.id,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session, ["completed_activity"])

        assert session.completed_activity is not None
        assert session.completed_activity.id == test_activity.id
