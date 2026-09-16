import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_db
from backend.auth import verify_password

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_register_and_login():
    test_user = "test_user_auth"
    test_pass = "secure_pass_123"

    # Clean up test user if exists
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE username = ?", (test_user,))

    # Register
    res = client.post("/api/auth/register", json={"username": test_user, "password": test_pass})
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == test_user

    # Duplicate registration must fail
    res_dup = client.post("/api/auth/register", json={"username": test_user, "password": test_pass})
    assert res_dup.status_code == 400

    # Login with correct credentials
    login_res = client.post("/api/auth/login", json={"username": test_user, "password": test_pass})
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    assert token is not None

    # Login with incorrect password
    bad_login = client.post("/api/auth/login", json={"username": test_user, "password": "wrong_password"})
    assert bad_login.status_code == 401

    # Protected route access (/api/auth/me) without token
    unauth = client.get("/api/auth/me")
    assert unauth.status_code == 401

    # Protected route access with token
    auth_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert auth_res.status_code == 200
    assert auth_res.json()["username"] == test_user

def test_password_hashing_security():
    # Verify passwords are not stored in plaintext in SQLite (NFR-02)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT hashed_password FROM users LIMIT 1")
        row = cursor.fetchone()
        if row:
            stored_hash = row["hashed_password"]
            assert stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$")
