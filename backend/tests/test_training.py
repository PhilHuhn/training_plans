"""
Tests for training routes.
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.training_session import TrainingSession, UploadedPlan, SessionSource, SessionStatus


class TestTrainingSessionsAPI:
    """Tests for the training sessions API endpoints."""

    async def test_list_sessions(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test listing training sessions."""
        response = await client.get("/api/training/sessions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_sessions_with_date_range(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test listing sessions with date range filter."""
        start_date = (date.today() - timedelta(days=7)).isoformat()
        end_date = (date.today() + timedelta(days=7)).isoformat()
        response = await client.get(
            "/api/training/sessions",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_weekly_sessions(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test getting weekly training sessions."""
        response = await client.get(
            "/api/training/sessions/week",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert "week_start" in data
        assert "week_end" in data

    async def test_get_weekly_sessions_specific_week(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test getting specific week's sessions."""
        week_start = date.today() - timedelta(days=date.today().weekday())
        response = await client.get(
            "/api/training/sessions/week",
            params={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_create_session(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating a training session."""
        response = await client.post(
            "/api/training/sessions",
            json={
                "session_date": (date.today() + timedelta(days=1)).isoformat(),
                "source": "manual",
                "planned_workout": {
                    "type": "Tempo Run",
                    "description": "6x1km at tempo pace",
                    "distance_km": 12.0,
                    "duration_min": 60,
                    "intensity": "hard",
                },
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["source"] == "manual"
        assert data["planned_workout"]["type"] == "Tempo Run"

    async def test_update_session(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test updating a training session."""
        response = await client.put(
            f"/api/training/sessions/{test_training_session.id}",
            json={
                "status": "completed",
                "notes": "Felt great!",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["notes"] == "Felt great!"

    async def test_delete_session(
        self, client: AsyncClient, db: AsyncSession, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test deleting a training session."""
        session_id = test_training_session.id
        response = await client.delete(
            f"/api/training/sessions/{session_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify deletion
        result = await db.execute(
            select(TrainingSession).where(TrainingSession.id == session_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_accept_planned_workout(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test accepting the planned workout."""
        # API expects 'source' as a query parameter, not JSON body
        response = await client.post(
            f"/api/training/sessions/{test_training_session.id}/accept",
            params={"source": "planned"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["accepted_source"] == "planned"

    async def test_accept_ai_workout(
        self, client: AsyncClient, db: AsyncSession, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test accepting the AI recommendation."""
        # First add a recommendation_workout to the session
        test_training_session.recommendation_workout = {
            "type": "tempo",
            "description": "AI recommended tempo run",
            "distance_km": 10.0,
        }
        await db.commit()

        response = await client.post(
            f"/api/training/sessions/{test_training_session.id}/accept",
            params={"source": "ai"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["accepted_source"] == "ai"


class TestTrainingDashboard:
    """Tests for the training dashboard page."""

    async def test_dashboard_page(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_cookies: dict
    ):
        """Test dashboard page renders correctly."""
        response = await client.get("/dashboard", cookies=auth_cookies)
        assert response.status_code == 200

    async def test_dashboard_week_navigation(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test week navigation on dashboard."""
        next_week = (date.today() + timedelta(days=7)).isoformat()
        response = await client.get(
            f"/dashboard?week={next_week}",
            cookies=auth_cookies,
        )
        assert response.status_code == 200

    async def test_training_page_alias(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test /training is an alias for /dashboard."""
        response = await client.get("/training", cookies=auth_cookies)
        assert response.status_code == 200


class TestUploadedPlans:
    """Tests for uploaded training plan functionality."""

    async def test_list_uploaded_plans(
        self, client: AsyncClient, test_uploaded_plan: UploadedPlan, auth_headers: dict
    ):
        """Test listing uploaded plans."""
        response = await client.get("/api/training/uploaded-plans", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["filename"] == test_uploaded_plan.filename

    async def test_delete_uploaded_plan(
        self, client: AsyncClient, db: AsyncSession, test_uploaded_plan: UploadedPlan, auth_headers: dict
    ):
        """Test deleting an uploaded plan."""
        plan_id = test_uploaded_plan.id
        response = await client.delete(
            f"/api/training/uploaded-plans/{plan_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify deletion
        result = await db.execute(
            select(UploadedPlan).where(UploadedPlan.id == plan_id)
        )
        assert result.scalar_one_or_none() is None


class TestSessionWorkflows:
    """Tests for training session workflows."""

    async def test_session_status_transitions(
        self, client: AsyncClient, db: AsyncSession, test_user: User, auth_headers: dict
    ):
        """Test session status transitions."""
        # Use a future date to avoid conflict with other tests
        future_date = (date.today() + timedelta(days=10)).isoformat()

        # Create a session - WorkoutDetails requires 'description' field
        response = await client.post(
            "/api/training/sessions",
            json={
                "session_date": future_date,
                "source": "manual",
                "planned_workout": {"type": "Easy Run", "description": "Easy 5k", "distance_km": 5.0},
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        session_id = response.json()["id"]

        # Mark as completed
        response = await client.put(
            f"/api/training/sessions/{session_id}",
            json={"status": "completed"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

    async def test_session_with_workout_modification(
        self, client: AsyncClient, test_training_session: TrainingSession, auth_headers: dict
    ):
        """Test modifying a session's workout."""
        response = await client.put(
            f"/api/training/sessions/{test_training_session.id}",
            json={
                "status": "modified",
                "final_workout": {
                    "type": "Modified Run",
                    "description": "Changed due to fatigue",
                    "distance_km": 6.0,
                    "intensity": "easy",
                },
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "modified"


class TestSessionUserIsolation:
    """Tests for user isolation in training sessions."""

    async def test_cannot_see_other_users_sessions(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_training_session: TrainingSession,
    ):
        """Test that users cannot see other users' sessions."""
        from app.core.security import get_password_hash, create_access_token

        other_user = User(
            email="othertrain@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Other user's session list should be empty
        response = await client.get("/api/training/sessions", headers=other_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    async def test_cannot_update_other_users_sessions(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_training_session: TrainingSession,
    ):
        """Test that users cannot update other users' sessions."""
        from app.core.security import get_password_hash, create_access_token

        other_user = User(
            email="othertrain2@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        response = await client.put(
            f"/api/training/sessions/{test_training_session.id}",
            json={"notes": "Hacked!"},
            headers=other_headers,
        )
        assert response.status_code == 404


class TestSessionSources:
    """Tests for different session sources."""

    async def test_create_manual_session(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating a manual session."""
        # Use a date that won't conflict with other tests
        test_date = (date.today() + timedelta(days=20)).isoformat()
        response = await client.post(
            "/api/training/sessions",
            json={
                "session_date": test_date,
                "source": "manual",
                "planned_workout": {"type": "Custom Workout", "description": "A custom session"},
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["source"] == "manual"

    async def test_create_uploaded_plan_session(
        self, client: AsyncClient, test_user: User, test_uploaded_plan: UploadedPlan, auth_headers: dict
    ):
        """Test creating a session from uploaded plan."""
        # Use a date that won't conflict with other tests
        test_date = (date.today() + timedelta(days=21)).isoformat()
        response = await client.post(
            "/api/training/sessions",
            json={
                "session_date": test_date,
                "source": "uploaded_plan",
                "planned_workout": {"type": "Plan Workout", "description": "From plan"},
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["source"] == "uploaded_plan"


class TestHealthCheck:
    """Tests for health check endpoint."""

    async def test_health_check(self, client: AsyncClient):
        """Test health check endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
