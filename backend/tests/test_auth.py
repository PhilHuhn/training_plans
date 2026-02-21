"""
Tests for authentication routes.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.core.security import verify_password


class TestAuthRegistration:
    """Tests for user registration."""

    async def test_register_api(self, client: AsyncClient, db: AsyncSession):
        """Test API registration endpoint."""
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
                "name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_form(self, client: AsyncClient, db: AsyncSession):
        """Test form-based registration."""
        response = await client.post(
            "/register",
            data={
                "email": "formuser@example.com",
                "password": "password123",
                "confirm_password": "password123",
                "name": "Form User",
            },
            follow_redirects=False,
        )
        # Should redirect to dashboard on success
        assert response.status_code == 302
        assert response.headers["location"] == "/dashboard"
        assert "access_token" in response.cookies

    async def test_register_password_mismatch(self, client: AsyncClient, db: AsyncSession):
        """Test registration with mismatched passwords."""
        response = await client.post(
            "/register",
            data={
                "email": "mismatch@example.com",
                "password": "password123",
                "confirm_password": "differentpassword",
                "name": "Mismatch User",
            },
        )
        # Should show error on same page
        assert response.status_code == 200
        assert "Passwords do not match" in response.text

    async def test_register_duplicate_email(
        self, client: AsyncClient, db: AsyncSession, test_user: User
    ):
        """Test registration with duplicate email."""
        response = await client.post(
            "/api/auth/register",
            json={
                "email": test_user.email,
                "password": "password123",
                "name": "Duplicate",
            },
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    async def test_register_invalid_email(self, client: AsyncClient, db: AsyncSession):
        """Test registration with invalid email format."""
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "notanemail",
                "password": "password123",
                "name": "Invalid Email",
            },
        )
        assert response.status_code == 422  # Validation error


class TestAuthLogin:
    """Tests for user login."""

    async def test_login_api(self, client: AsyncClient, test_user: User):
        """Test API login endpoint."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "password123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_form(self, client: AsyncClient, test_user: User):
        """Test form-based login."""
        response = await client.post(
            "/login",
            data={
                "email": test_user.email,
                "password": "password123",
            },
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "/dashboard"
        assert "access_token" in response.cookies

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        """Test login with wrong password."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent email."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 401

    async def test_login_form_wrong_credentials(self, client: AsyncClient, test_user: User):
        """Test form login with wrong credentials shows error."""
        response = await client.post(
            "/login",
            data={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 200
        assert "Invalid email or password" in response.text


class TestAuthMe:
    """Tests for /auth/me endpoint."""

    async def test_get_current_user(
        self, client: AsyncClient, test_user: User, auth_headers: dict
    ):
        """Test getting current user info."""
        response = await client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name
        assert "password" not in data
        assert "password_hash" not in data

    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test accessing /auth/me without token."""
        response = await client.get("/api/auth/me")
        assert response.status_code == 401

    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test accessing /auth/me with invalid token."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert response.status_code == 401


class TestAuthLogout:
    """Tests for logout."""

    async def test_logout(self, client: AsyncClient, auth_cookies: dict):
        """Test logout clears cookie."""
        # First login
        response = await client.get(
            "/logout",
            cookies=auth_cookies,
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
        # Cookie should be deleted
        assert "access_token" in response.headers.get("set-cookie", "").lower()


class TestAuthPages:
    """Tests for auth page access."""

    async def test_login_page_unauthenticated(self, client: AsyncClient):
        """Test login page is accessible when not logged in."""
        response = await client.get("/login")
        assert response.status_code == 200
        assert "login" in response.text.lower()

    async def test_login_page_authenticated_redirects(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test login page redirects if already logged in."""
        response = await client.get(
            "/login",
            cookies=auth_cookies,
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "/dashboard"

    async def test_register_page_unauthenticated(self, client: AsyncClient):
        """Test register page is accessible when not logged in."""
        response = await client.get("/register")
        assert response.status_code == 200
        assert "register" in response.text.lower()

    async def test_register_page_authenticated_redirects(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test register page redirects if already logged in."""
        response = await client.get(
            "/register",
            cookies=auth_cookies,
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "/dashboard"

    async def test_home_unauthenticated_redirects_login(self, client: AsyncClient):
        """Test home redirects to login when not authenticated."""
        response = await client.get("/", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    async def test_home_authenticated_redirects_dashboard(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test home redirects to dashboard when authenticated."""
        response = await client.get("/", cookies=auth_cookies, follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/dashboard"


class TestProtectedRoutes:
    """Tests for protected route access."""

    async def test_dashboard_requires_auth(self, client: AsyncClient):
        """Test dashboard redirects to login when not authenticated."""
        response = await client.get("/dashboard", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    async def test_dashboard_accessible_authenticated(
        self, client: AsyncClient, auth_cookies: dict
    ):
        """Test dashboard is accessible when authenticated."""
        response = await client.get("/dashboard", cookies=auth_cookies)
        assert response.status_code == 200

    async def test_activities_requires_auth(self, client: AsyncClient):
        """Test activities page redirects to login when not authenticated."""
        response = await client.get("/activities", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    async def test_competitions_requires_auth(self, client: AsyncClient):
        """Test competitions page redirects to login when not authenticated."""
        response = await client.get("/competitions", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    async def test_settings_requires_auth(self, client: AsyncClient):
        """Test settings page redirects to login when not authenticated."""
        response = await client.get("/settings", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
