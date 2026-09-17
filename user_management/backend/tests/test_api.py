from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import Claims, get_current_claims, require_permission
from app.main import app
from app.services.rfid_service import rfid_service


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert data["docs_url"] == "/docs"


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_login_missing_credentials():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 400
        data = resp.json()
        assert data["success"] is False
        assert "error" in data


@pytest.mark.asyncio
async def test_forgot_password_public():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Should always return 200 without email enumeration
        resp = await client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@example.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "shortly" in data["message"]


@pytest.mark.asyncio
async def test_protected_routes_require_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Users
        resp = await client.get("/api/v1/users")
        assert resp.status_code == 401

        # RFID
        resp = await client.get("/api/v1/rfid")
        assert resp.status_code == 401

        # Dashboard
        resp = await client.get("/api/v1/dashboard/overview")
        assert resp.status_code == 401

        # Audit
        resp = await client.get("/api/v1/audit")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_rfid_scan_simulated_with_auth():
    # Override security dependency to mock authenticated user
    mock_claims = Claims(sub="user-1", email="admin@ococ.campus.edu", roles=["SUPER_ADMIN"])
    app.dependency_overrides[get_current_claims] = lambda: mock_claims
    app.dependency_overrides[require_permission("rfid:read")] = lambda: mock_claims

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/rfid/scan")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert "uid" in data["data"]
            assert len(data["data"]["uid"]) == 8

            status_resp = await client.get("/api/v1/rfid/reader/status")
            assert status_resp.status_code == 200
            status_data = status_resp.json()
            assert status_data["data"]["status"] == "idle"
            assert status_data["data"]["simulated"] is True
    finally:
        app.dependency_overrides.clear()


def test_rfid_uid_validation():
    # Valid 8-hex string
    valid, _ = rfid_service.validate_uid_format("1A2B3C4D")
    assert valid is True

    # Valid 14-hex string
    valid, _ = rfid_service.validate_uid_format("04A1B2C3D4E5F6")
    assert valid is True

    # Invalid non-hex string
    valid, msg = rfid_service.validate_uid_format("INVALID_HEX!")
    assert valid is False
    assert "hex" in msg

    # Invalid short length
    valid, msg = rfid_service.validate_uid_format("123")
    assert valid is False


@pytest.mark.asyncio
async def test_departments_and_hostels(override_db_dependency):
    override_db_dependency.fetch.side_effect = [
        [{"id": "00000000-0000-0000-0000-000000000001", "name": "Computer Science", "code": "CS", "school": "Engineering"}],
        [{"id": "00000000-0000-0000-0000-000000000002", "name": "Hostel A", "code": "HA", "capacity": 100}],
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        dept_resp = await client.get("/api/v1/departments")
        assert dept_resp.status_code == 200
        dept_data = dept_resp.json()
        assert dept_data["success"] is True
        assert len(dept_data["data"]) == 1
        assert dept_data["data"][0]["name"] == "Computer Science"

        hostel_resp = await client.get("/api/v1/hostels")
        assert hostel_resp.status_code == 200
        hostel_data = hostel_resp.json()
        assert hostel_data["success"] is True
        assert len(hostel_data["data"]) == 1
        assert hostel_data["data"][0]["name"] == "Hostel A"


@pytest.mark.asyncio
async def test_public_registration(override_db_dependency):
    override_db_dependency.fetchval.return_value = False  # email doesn't exist
    override_db_dependency.fetchrow.return_value = {
        "id": "11111111-1111-1111-1111-111111111111",
        "keycloak_user_id": "kc-123",
        "user_type": "student",
        "status": "active",
        "email": "newstudent@ococ.campus.edu",
        "phone": "+919876543210",
        "created_at": None,
        "updated_at": None,
        "full_name": "Jane Student",
        "roll_number": "CS2026001",
        "employee_id": None,
        "department_id": None,
        "hostel_id": None,
        "department": "Computer Science",
        "school": "Engineering",
        "course": "B.Tech",
        "semester": "1",
        "designation": None,
        "hostel_flag": False,
        "emergency_contact": None,
        "guardian_contact": None,
        "photo_reference": None,
        "gov_id_type": None,
        "gov_id_number": None,
        "visit_purpose": None,
        "host_contact": None,
        "visit_start": None,
        "visit_duration_days": None,
        "p_updated_at": None,
        "active_rfid": None,
        "has_face_auth": False,
    }

    payload = {
        "role": "student",
        "full_name": "Jane Student",
        "email": "newstudent@ococ.campus.edu",
        "phone": "+919876543210",
        "roll_number": "CS2026001",
        "department": "Computer Science",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/register", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["email"] == "newstudent@ococ.campus.edu"


def test_claims_role_enforcement():
    claims = Claims(
        sub="test-user-id",
        email="admin@ococ.campus.edu",
        roles=["ADMIN", "USER_MANAGER"],
    )
    assert claims.has_any_role("ADMIN") is True
    assert claims.has_any_role("SUPER_ADMIN", "ADMIN") is True
    assert claims.has_any_role("SUPER_ADMIN") is False
