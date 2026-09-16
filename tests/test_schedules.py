import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

@pytest.fixture
def auth_token():
    username = "schedule_tester"
    password = "tester_password_123"
    # Register or login
    client.post("/api/auth/register", json={"username": username, "password": password})
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    return res.json()["access_token"]

def test_schedules_crud(auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}

    # 1. Create schedule
    new_sch = {
        "name": "Evening Study Light",
        "period": "Night",
        "start_time": "19:30",
        "end_time": "21:30",
        "brightness_pct": 50,
        "is_active": True
    }
    create_res = client.post("/api/schedules", json=new_sch, headers=headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    schedule_id = created_data["id"]
    assert created_data["name"] == "Evening Study Light"
    assert created_data["brightness_pct"] == 50

    # 2. Get schedule by ID
    get_res = client.get(f"/api/schedules/{schedule_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Evening Study Light"

    # 3. Search and filter schedules
    search_res = client.get("/api/schedules?q=Study")
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1
    assert any(s["id"] == schedule_id for s in search_res.json())

    filter_res = client.get("/api/schedules?period=Night")
    assert filter_res.status_code == 200
    assert all(s["period"] == "Night" for s in filter_res.json())

    # 4. Update schedule
    update_res = client.put(
        f"/api/schedules/{schedule_id}",
        json={"name": "Evening Chill Light", "brightness_pct": 40},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Evening Chill Light"
    assert update_res.json()["brightness_pct"] == 40

    # 5. Delete schedule
    del_res = client.delete(f"/api/schedules/{schedule_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deleted
    get_after_del = client.get(f"/api/schedules/{schedule_id}")
    assert get_after_del.status_code == 404

def test_schedule_validation(auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Invalid time format
    bad_time = {
        "name": "Bad Time Schedule",
        "period": "Morning",
        "start_time": "25:99",
        "end_time": "08:00",
        "brightness_pct": 50,
        "is_active": True
    }
    res = client.post("/api/schedules", json=bad_time, headers=headers)
    assert res.status_code == 422

    # Invalid brightness > 100
    bad_bright = {
        "name": "Bad Brightness Schedule",
        "period": "Morning",
        "start_time": "07:00",
        "end_time": "09:00",
        "brightness_pct": 150,
        "is_active": True
    }
    res2 = client.post("/api/schedules", json=bad_bright, headers=headers)
    assert res2.status_code == 422

def test_unauthorized_schedule_mutations():
    # Attempting to create schedule without auth header must return 401 (NFR-06)
    new_sch = {
        "name": "Unauthorized Schedule",
        "period": "Day",
        "start_time": "11:00",
        "end_time": "12:00",
        "brightness_pct": 70,
        "is_active": True
    }
    res = client.post("/api/schedules", json=new_sch)
    assert res.status_code == 401
