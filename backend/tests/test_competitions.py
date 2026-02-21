"""
Tests for competitions routes.
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.competition import Competition, RaceType, RacePriority


class TestCompetitionsAPI:
    """Tests for the competitions API endpoints."""

    async def test_list_competitions(
        self, client: AsyncClient, test_competitions: list[Competition], auth_headers: dict
    ):
        """Test listing competitions."""
        response = await client.get("/api/competitions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == len(test_competitions)

    async def test_create_competition(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating a competition via API."""
        response = await client.post(
            "/api/competitions",
            json={
                "name": "New Race",
                "race_type": "10K",
                "distance": 10000.0,
                "race_date": (date.today() + timedelta(days=45)).isoformat(),
                "goal_time": 2700,
                "priority": "B",
                "location": "Test City",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200  # API returns 200 for create
        data = response.json()
        assert data["name"] == "New Race"
        assert data["race_type"] == "10K"
        assert data["priority"] == "B"

    async def test_create_competition_minimal(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating a competition with minimal data."""
        response = await client.post(
            "/api/competitions",
            json={
                "name": "Minimal Race",
                "race_type": "5K",
                "race_date": (date.today() + timedelta(days=30)).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 200  # API returns 200 for create
        data = response.json()
        assert data["name"] == "Minimal Race"
        assert data["priority"] == "B"  # Default priority

    async def test_get_competition(
        self, client: AsyncClient, test_competition: Competition, auth_headers: dict
    ):
        """Test getting a single competition."""
        response = await client.get(
            f"/api/competitions/{test_competition.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_competition.id
        assert data["name"] == test_competition.name
        assert data["race_type"] == test_competition.race_type.value

    async def test_get_competition_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test getting nonexistent competition."""
        response = await client.get("/api/competitions/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_update_competition(
        self, client: AsyncClient, test_competition: Competition, auth_headers: dict
    ):
        """Test updating a competition."""
        response = await client.put(
            f"/api/competitions/{test_competition.id}",
            json={
                "name": "Updated Marathon",
                "goal_time": 12000,
                "priority": "A",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Marathon"
        assert data["goal_time"] == 12000
        assert data["priority"] == "A"

    async def test_delete_competition(
        self, client: AsyncClient, db: AsyncSession, test_competition: Competition, auth_headers: dict
    ):
        """Test deleting a competition."""
        competition_id = test_competition.id
        response = await client.delete(
            f"/api/competitions/{competition_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify deletion
        result = await db.execute(
            select(Competition).where(Competition.id == competition_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_delete_competition_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test deleting nonexistent competition."""
        response = await client.delete("/api/competitions/99999", headers=auth_headers)
        assert response.status_code == 404


class TestCompetitionsPage:
    """Tests for the competitions HTML page."""

    async def test_competitions_page(
        self, client: AsyncClient, test_competitions: list[Competition], auth_cookies: dict
    ):
        """Test competitions page renders correctly."""
        response = await client.get("/competitions", cookies=auth_cookies)
        assert response.status_code == 200
        for comp in test_competitions:
            assert comp.name in response.text

    async def test_competitions_page_requires_auth(self, client: AsyncClient):
        """Test competitions page requires authentication."""
        response = await client.get("/competitions", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"


class TestCompetitionRaceTypes:
    """Tests for race type handling."""

    async def test_all_race_types(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating competitions with all race types."""
        race_types = ["5K", "10K", "HM", "M", "50K", "100K", "50M", "100M", "OTHER"]

        for race_type in race_types:
            response = await client.post(
                "/api/competitions",
                json={
                    "name": f"{race_type} Race",
                    "race_type": race_type,
                    "race_date": (date.today() + timedelta(days=30)).isoformat(),
                },
                headers=auth_headers,
            )
            assert response.status_code == 200, f"Failed for race type: {race_type}"
            data = response.json()
            assert data["race_type"] == race_type

    async def test_invalid_race_type(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test creating competition with invalid race type returns 422."""
        response = await client.post(
            "/api/competitions",
            json={
                "name": "Invalid Race",
                "race_type": "INVALID",
                "race_date": (date.today() + timedelta(days=30)).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data


class TestCompetitionPriorities:
    """Tests for race priority handling."""

    async def test_all_priorities(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test creating competitions with all priorities."""
        priorities = ["A", "B", "C"]

        for priority in priorities:
            response = await client.post(
                "/api/competitions",
                json={
                    "name": f"Priority {priority} Race",
                    "race_type": "10K",
                    "race_date": (date.today() + timedelta(days=30)).isoformat(),
                    "priority": priority,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["priority"] == priority


class TestCompetitionGoals:
    """Tests for competition goal handling."""

    async def test_goal_time_and_pace(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test setting goal time and pace."""
        response = await client.post(
            "/api/competitions",
            json={
                "name": "Goal Race",
                "race_type": "HM",
                "race_date": (date.today() + timedelta(days=60)).isoformat(),
                "goal_time": 5400,  # 1:30:00
                "goal_pace": 256,  # ~4:16 min/km
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["goal_time"] == 5400
        assert data["goal_pace"] == 256


class TestCompetitionUserIsolation:
    """Tests for user isolation in competitions."""

    async def test_cannot_see_other_users_competitions(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_competition: Competition,
    ):
        """Test that users cannot see other users' competitions."""
        from app.core.security import get_password_hash, create_access_token

        # Create another user
        other_user = User(
            email="othercomp@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        # Get token for other user
        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Try to access test_user's competition
        response = await client.get(
            f"/api/competitions/{test_competition.id}",
            headers=other_headers,
        )
        assert response.status_code == 404

    async def test_cannot_update_other_users_competitions(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_competition: Competition,
    ):
        """Test that users cannot update other users' competitions."""
        from app.core.security import get_password_hash, create_access_token

        other_user = User(
            email="othercomp2@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        response = await client.put(
            f"/api/competitions/{test_competition.id}",
            json={"name": "Hacked Race"},
            headers=other_headers,
        )
        assert response.status_code == 404

    async def test_cannot_delete_other_users_competitions(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_competition: Competition,
    ):
        """Test that users cannot delete other users' competitions."""
        from app.core.security import get_password_hash, create_access_token

        other_user = User(
            email="othercomp3@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        response = await client.delete(
            f"/api/competitions/{test_competition.id}",
            headers=other_headers,
        )
        assert response.status_code == 404

        # Verify competition still exists
        result = await db.execute(
            select(Competition).where(Competition.id == test_competition.id)
        )
        assert result.scalar_one_or_none() is not None


class TestCompetitionHTMX:
    """Tests for HTMX-specific competition endpoints."""

    async def test_competitions_list_partial(
        self, client: AsyncClient, test_competitions: list[Competition], auth_cookies: dict
    ):
        """Test HTMX partial for competitions list."""
        response = await client.get(
            "/partials/competitions-list",
            cookies=auth_cookies,
            headers={"HX-Request": "true"},
        )
        assert response.status_code == 200
        # Should return HTML partial
        for comp in test_competitions:
            assert comp.name in response.text

    async def test_competitions_list_partial_unauthorized(self, client: AsyncClient):
        """Test HTMX partial requires auth."""
        response = await client.get("/partials/competitions-list")
        assert response.status_code == 401
