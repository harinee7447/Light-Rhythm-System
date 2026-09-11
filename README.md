# Light Rhythm Management System

A circadian-aligned lighting control and scheduling web application built with **Python (FastAPI)**, **SQLite**, and a modern, responsive **Frontend**. Strictly adhering to [SRS.md](file:///c:/Non%20Formal/SRS.md) and [REQUIREMENTS.md](file:///c:/Non%20Formal/REQUIREMENTS.md).

---

## 🌟 Features (SRS Compliance)

| ID | Feature | Description |
| :--- | :--- | :--- |
| **FR-01** | **Daily Light Schedules** | Set and manage daily light schedules based on time with full CRUD operations, time validation, and search/filtering. |
| **FR-02** | **Circadian Brightness Engine** | Automatic brightness adjustment for Morning (60%), Day (75%), and Night (25%), with manual overrides and automatic restoration. |
| **FR-03** | **Light Routines** | Create, edit, activate, and delete light routines with custom brightness levels and execution triggers. |
| **FR-04** | **SQLite Storage** | Persistent SQLite database for user accounts, schedules, routines, system settings, and activity logs. |
| **FR-05** | **Live Dashboard** | Real-time dashboard showing current light mode, animated brightness meter, live 24-hour circadian curve, active schedules, and recent activity (loads in <2s, fulfilling NFR-01). |
| **FR-06** | **Activity History & Audit** | Full chronological logging of light changes, schedule alterations, routine executions, and user activities with category filtering and CSV export. |

---

## 🛡️ Non-Functional Requirements (NFR)

* **NFR-01 (Performance):** Dashboard and API endpoints respond within **2 seconds**.
* **NFR-02 (Security):** Passwords stored using secure industry-standard **bcrypt hashing**.
* **NFR-03 (Usability):** Intuitive UI with pre-filled defaults allows setting routines in under **3 minutes**.
* **NFR-04 (Reliability):** System maintains **99%+ availability** with built-in health checks (`/api/health`).
* **NFR-05 (Write Performance):** All schedule and routine changes persist to SQLite in under **2 seconds**.
* **NFR-06 (Access Control):** **100% authentication checks** enforced on protected endpoints using JWT bearer tokens.

---

## 🏗️ Architecture & Project Structure

```
c:\Non Formal\
├── SRS.md                    # Canonical Software Requirements Specification
├── REQUIREMENTS.md           # Consolidated Requirements, User Stories & Use Cases
├── README.md                 # Setup, run, and usage instructions
├── light_rhythm.db           # SQLite Database (auto-created on first run)
├── backend/                  # FastAPI Backend
│   ├── __init__.py
│   ├── main.py               # FastAPI entry point & static file hosting
│   ├── config.py             # Configuration, JWT secrets, and DB paths
│   ├── database.py           # SQLite connection, schema init, seed data
│   ├── models.py             # Pydantic validation schemas
│   ├── auth.py               # bcrypt password hashing & JWT token handling
│   └── routers/
│       ├── __init__.py
│       ├── auth_router.py     # /api/auth (Register, Login, Me)
│       ├── schedule_router.py # /api/schedules (FR-01 CRUD & search)
│       ├── brightness_router.py # /api/brightness (FR-02 circadian engine)
│       ├── routine_router.py  # /api/routines (FR-03 CRUD & execution)
│       ├── history_router.py  # /api/history (FR-06 audit log & search)
│       ├── dashboard_router.py # /api/dashboard (FR-05 unified stats)
│       └── report_router.py   # /api/reports (Analytics & CSV export)
├── Frontend/                 # Modern Responsive UI
│   ├── index.html            # Main UI structure with interactive modals
│   ├── style.css             # Polished circadian theme & responsive layouts
│   └── script.js             # API client, live clock, modals, and state manager
└── tests/                    # Automated Test Suite (Pytest)
    ├── __init__.py
    ├── test_auth.py          # Auth & password security tests
    ├── test_schedules.py     # Schedule CRUD & validation tests
    ├── test_routines.py      # Routine CRUD & execution tests
    ├── test_brightness.py    # Circadian threshold calculation tests
    └── test_history_reports.py # Audit log, performance & export tests
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
* Python 3.10 or higher installed.

### 2. Install Dependencies
Run the following command in the project root:
```powershell
pip install fastapi "uvicorn[standard]" python-jose bcrypt python-multipart pytest httpx
```

### 3. Run the Application
Launch the combined backend server and frontend web application:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Open the Web Application
Open your web browser and navigate to:
```
ttp://127.0.0.1:8000/
```

### 5. Interactive Swagger API Docs
FastAPI provides interactive API documentation at:
```
http://127.0.0.1:8000/docs
```

---

## 🧪 Running Automated Tests

Run the automated test suite with pytest:
```powershell
pytest tests/ -v
```

All 12 test suites will run, validating authentication, CRUD operations, circadian algorithms, data validation, database persistence, and API performance.
h