import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db
from backend.routers.brightness_router import determine_circadian_mode

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

@pytest.fixture
def auth_token():
    username = "brightness_tester"
    password = "tester_password_123"
    client.post("/api/auth/register", json={"username": username, "password": password})
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    return res.json()["access_token"]

def test_circadian_logic_function():
    # Morning: 06:00 - 10:00 -> 60%
    mode, pct, symbol, _, _ = determine_circadian_mode(7, 30)
    assert mode == "Morning"
    assert pct == 60

    # Day: 10:00 - 18:00 -> 75%
    mode, pct, symbol, _, _ = determine_circadian_mode(12, 15)
    assert mode == "Day"
    assert pct == 75

    # Night: 18:00 - 06:00 -> 25%
    mode, pct, symbol, _, _ = determine_circadian_mode(21, 0)
    assert mode == "Night"
    assert pct == 25

def test_brightness_endpoints(auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get current brightness
    res = client.get("/api/brightness/current")
    assert res.status_code == 200
    data = res.json()
    assert "current_mode" in data
    assert "brightness_pct" in data
    assert 0 <= data["brightness_pct"] <= 100

    # Manual mode selection
    mode_res = client.post("/api/brightness/mode", json={"mode": "Night", "brightness_pct": 30}, headers=headers)
    assert mode_res.status_code == 200

    # Check updated
    res2 = client.get("/api/brightness/current")
    assert res2.json()["current_mode"] == "Night"
    assert res2.json()["brightness_pct"] == 30

    # Reset back to automatic
    reset_res = client.post("/api/brightness/reset", headers=headers)
    assert reset_res.status_code == 200
    res3 = client.get("/api/brightness/current")
    assert res3.json()["is_automatic"] is True
