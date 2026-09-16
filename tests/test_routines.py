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
    username = "routine_tester"
    password = "tester_password_123"
    client.post("/api/auth/register", json={"username": username, "password": password})
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    return res.json()["access_token"]

def test_routines_crud(auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}

    # 1. Create Routine
    new_routine = {
        "name": "Midday Focus Flow",
        "period": "Day",
        "time": "14:00",
        "brightness_pct": 85,
        "description": "Peak daylight concentration boost",
        "is_active": True
    }
    create_res = client.post("/api/routines", json=new_routine, headers=headers)
    assert create_res.status_code == 201
    routine_data = create_res.json()
    routine_id = routine_data["id"]
    assert routine_data["name"] == "Midday Focus Flow"
    assert routine_data["brightness_pct"] == 85

    # 2. Get by ID
    get_res = client.get(f"/api/routines/{routine_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Midday Focus Flow"

    # 3. Search and filter
    search_res = client.get("/api/routines?q=Focus")
    assert search_res.status_code == 200
    assert any(r["id"] == routine_id for r in search_res.json())

    filter_res = client.get("/api/routines?period=Day")
    assert filter_res.status_code == 200
    assert all(r["period"] == "Day" for r in filter_res.json())

    # 4. Activate Routine
    act_res = client.post(f"/api/routines/{routine_id}/activate", headers=headers)
    assert act_res.status_code == 200
    assert "activated successfully" in act_res.json()["message"]

    # 5. Update Routine
    upd_res = client.put(
        f"/api/routines/{routine_id}",
        json={"name": "Midday Calm Flow", "brightness_pct": 70},
        headers=headers
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Midday Calm Flow"

    # 6. Delete Routine
    del_res = client.delete(f"/api/routines/{routine_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deleted
    get_del = client.get(f"/api/routines/{routine_id}")
    assert get_del.status_code == 404
