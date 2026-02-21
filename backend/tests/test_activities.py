"""
Tests for activities routes.
"""
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.activity import Activity


class TestActivitiesAPI:
    """Tests for the activities API endpoints."""

    async def test_list_activities(
        self, client: AsyncClient, test_user: User, test_activities: list[Activity], auth_headers: dict
    ):
        """Test listing activities."""
        response = await client.get("/api/activities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert len(data["activities"]) == len(test_activities)

    async def test_list_activities_pagination(
        self, client: AsyncClient, test_user: User, test_activities: list[Activity], auth_headers: dict
    ):
        """Test activities pagination."""
        response = await client.get(
            "/api/activities",
            params={"page": 1, "per_page": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 2
        assert data["page"] == 1
        assert data["per_page"] == 2

    async def test_list_activities_date_filter(
        self, client: AsyncClient, test_user: User, test_activities: list[Activity], auth_headers: dict
    ):
        """Test filtering activities by date."""
        # Filter to last 3 days - use date format not datetime
        start_date = (datetime.now() - timedelta(days=3)).date().isoformat()
        response = await client.get(
            "/api/activities",
            params={"start_date": start_date},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should get fewer activities due to date filter
        assert len(data["activities"]) <= len(test_activities)

    async def test_get_activity(
        self, client: AsyncClient, test_activity: Activity, auth_headers: dict
    ):
        """Test getting a single activity."""
        response = await client.get(
            f"/api/activities/{test_activity.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_activity.id
        assert data["name"] == test_activity.name
        assert data["distance"] == test_activity.distance

    async def test_get_activity_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test getting nonexistent activity."""
        response = await client.get("/api/activities/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_get_activity_unauthorized(self, client: AsyncClient, test_activity: Activity):
        """Test getting activity without auth."""
        response = await client.get(f"/api/activities/{test_activity.id}")
        assert response.status_code == 401

    async def test_get_activity_stats_summary(
        self, client: AsyncClient, test_activities: list[Activity], auth_headers: dict
    ):
        """Test activity statistics summary."""
        response = await client.get(
            "/api/activities/stats/summary",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_activities" in data
        assert "total_distance_km" in data
        assert "total_duration_hours" in data


class TestActivitiesPage:
    """Tests for the activities HTML page."""

    async def test_activities_page(
        self, client: AsyncClient, test_activities: list[Activity], auth_cookies: dict
    ):
        """Test activities page renders correctly."""
        response = await client.get("/activities", cookies=auth_cookies)
        assert response.status_code == 200
        assert "activities" in response.text.lower()

    async def test_activities_page_shows_stats(
        self, client: AsyncClient, test_activities: list[Activity], auth_cookies: dict
    ):
        """Test activities page shows statistics."""
        response = await client.get("/activities", cookies=auth_cookies)
        assert response.status_code == 200
        # Should show activity count
        assert str(len(test_activities)) in response.text

    async def test_activities_page_requires_auth(self, client: AsyncClient):
        """Test activities page requires authentication."""
        response = await client.get("/activities", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"


class TestActivityData:
    """Tests for activity data handling."""

    async def test_activity_with_heart_rate(
        self, client: AsyncClient, test_activity: Activity, auth_headers: dict
    ):
        """Test activity with heart rate data."""
        response = await client.get(
            f"/api/activities/{test_activity.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["avg_heart_rate"] == 145.0
        assert data["max_heart_rate"] == 175.0

    async def test_activity_with_pace(
        self, client: AsyncClient, test_activity: Activity, auth_headers: dict
    ):
        """Test activity with pace data."""
        response = await client.get(
            f"/api/activities/{test_activity.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["avg_pace"] == 360.0  # 6:00 min/km

    async def test_activity_with_elevation(
        self, client: AsyncClient, test_activity: Activity, auth_headers: dict
    ):
        """Test activity with elevation data."""
        response = await client.get(
            f"/api/activities/{test_activity.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["elevation_gain"] == 100.0


class TestActivityUserIsolation:
    """Tests for user isolation in activities."""

    async def test_cannot_see_other_users_activities(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_activity: Activity,
    ):
        """Test that users cannot see other users' activities."""
        from app.core.security import get_password_hash, create_access_token

        # Create another user
        other_user = User(
            email="other@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        # Get token for other user
        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Try to access test_user's activity
        response = await client.get(
            f"/api/activities/{test_activity.id}",
            headers=other_headers,
        )
        assert response.status_code == 404

    async def test_list_only_own_activities(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        test_activities: list[Activity],
    ):
        """Test that users only see their own activities in list."""
        from app.core.security import get_password_hash, create_access_token

        # Create another user with their own activity
        other_user = User(
            email="other2@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
        )
        db.add(other_user)
        await db.commit()
        await db.refresh(other_user)

        other_activity = Activity(
            user_id=other_user.id,
            strava_id="other_activity",
            name="Other User's Run",
            activity_type="Run",
            distance=5000.0,
            duration=1800,
            start_date=datetime.now(),
        )
        db.add(other_activity)
        await db.commit()

        # Get token for other user
        other_token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Other user should only see their activity
        response = await client.get("/api/activities", headers=other_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 1
        assert data["activities"][0]["name"] == "Other User's Run"
