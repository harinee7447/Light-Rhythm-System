import time
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_history_filtering_and_search():
    res = client.get("/api/history")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) > 0

    # Filter by event_type
    light_res = client.get("/api/history?event_type=LIGHT")
    assert light_res.status_code == 200
    for item in light_res.json():
        assert item["event_type"] == "LIGHT"

    # Search keyword
    search_res = client.get("/api/history?q=activated")
    assert search_res.status_code == 200

def test_dashboard_performance_and_content():
    # Test NFR-01: Response within 2 seconds
    start_time = time.time()
    res = client.get("/api/dashboard")
    elapsed = time.time() - start_time
    assert elapsed < 2.0, f"Dashboard took {elapsed}s, must be < 2.0s (NFR-01)"

    assert res.status_code == 200
    data = res.json()
    assert "current_mode" in data
    assert "brightness_pct" in data
    assert "schedules" in data
    assert "recent_history" in data
    assert "stats" in data

def test_reports_and_csv_export():
    # Summary report
    rep_res = client.get("/api/reports/summary")
    assert rep_res.status_code == 200
    summary = rep_res.json()
    assert summary["total_schedules"] >= 0
    assert summary["adherence_pct"] >= 0

    # Storage metrics
    store_res = client.get("/api/reports/storage")
    assert store_res.status_code == 200
    storage_data = store_res.json()
    assert storage_data["database_engine"] == "SQLite 3"
    assert "schedules" in storage_data["tables"]

    # CSV exports
    csv_sch = client.get("/api/reports/export.csv?type=schedules")
    assert csv_sch.status_code == 200
    assert "text/csv" in csv_sch.headers["content-type"]
    assert "Schedule Name" in csv_sch.text

    csv_routines = client.get("/api/reports/export.csv?type=routines")
    assert csv_routines.status_code == 200
    assert "Routine Name" in csv_routines.text

def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
