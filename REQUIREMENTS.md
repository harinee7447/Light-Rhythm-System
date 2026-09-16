# System Requirements Document
## Light Rhythm Management System

This document unifies the Functional Requirements, Non-Functional Requirements, User Stories, and Use Cases for the Light Rhythm Management System.

---

## 1. Functional Requirements (FR)

| Requirement ID | Description | Primary Component |
| :--- | :--- | :--- |
| **FR-01** | The system shall set and manage daily light schedules based on time. | Schedule Router & Database |
| **FR-02** | The system shall automatically adjust light brightness for morning, day, and night. | Brightness Controller Engine |
| **FR-03** | The system shall allow users to create and edit light routines. | Routine Router & Management UI |
| **FR-04** | The system shall store user settings and schedules in SQLite. | SQLite Database Engine |
| **FR-05** | The system shall show the current light mode and schedule on a dashboard. | Dashboard Router & Live UI |
| **FR-06** | The system shall keep a history of light changes and user activity. | Audit Logger & History UI |

---

## 2. Non-Functional Requirements (NFR)

* **NFR-01 (Performance):** The system shall display the dashboard within **2 seconds** of a user request.
* **NFR-02 (Security):** The system shall store passwords and other sensitive user data using **secure hashing** (bcrypt).
* **NFR-03 (Usability):** The system shall allow a new user to complete a routine-setting task within **3 minutes**.
* **NFR-04 (Reliability):** The system shall maintain **99% availability** during normal project testing.
* **NFR-05 (Response Time):** The system shall save each valid schedule or routine change to SQLite within **2 seconds**.
* **NFR-06 (Access Control):** The system shall prevent unauthorized users from accessing protected settings with **100% authentication checks** (JWT authentication).

---

## 3. User Stories (US)

* **US-01:** As a user, I want to set and manage daily light schedules based on time, so that the lights follow my planned schedule.
* **US-02:** As a user, I want the system to automatically adjust light brightness for morning, day, and night, so that the brightness matches the time of day.
* **US-03:** As a user, I want to create and edit light routines, so that I can manage my preferred light routines.
* **US-04:** As a user, I want my settings and schedules to be stored in SQLite, so that my light settings and schedules are saved.
* **US-05:** As a user, I want to see the current light mode and schedule on a dashboard, so that I can view the current light status and schedule.
* **US-06:** As a user, I want the system to keep a history of light changes and my activity, so that I can view the recorded history.

---

## 4. Use Cases (UC)

### UC-01 — Manage Daily Light Schedule
* **Actor:** User
* **Goal:** Set, update, view, or delete a daily light schedule based on time.
* **Main Flow:**
  1. User creates or edits a daily light schedule specifying start time, end time, and brightness level.
  2. System validates the schedule format and saves the record in SQLite within 2 seconds.
  3. System logs the schedule modification in the activity history.
  4. System updates active schedules for brightness automation.

### UC-02 — Adjust Light Brightness
* **Actor:** User / System Timer
* **Goal:** Have light brightness automatically adjusted for morning, day, and night.
* **Main Flow:**
  1. System identifies the current time of day.
  2. System compares time against defined schedule thresholds:
     - Morning (06:00 – 10:00): 60% Brightness
     - Day (10:00 – 18:00): 75% Brightness
     - Night (18:00 – 06:00): 25% Brightness
  3. System adjusts the brightness state and records the transition in activity history.

### UC-03 — Manage Light Routines
* **Actor:** User
* **Goal:** Create, view, edit, or delete light routines.
* **Main Flow:**
  1. User creates a custom light routine with target time, brightness, and description.
  2. System records the routine in SQLite.
  3. User can edit or activate routines at any time.
  4. System persists updates and logs user activity.

### UC-04 — Store Settings and Schedules
* **Actor:** User / System
* **Goal:** Persistently store user credentials, configurations, routines, and schedules in SQLite.
* **Main Flow:**
  1. System writes changes to the SQLite database with ACID compliance.
  2. Database maintains relations across users, schedules, routines, and audit logs.

### UC-05 — View Light Dashboard
* **Actor:** User
* **Goal:** View the real-time light mode, active brightness level, daily progression curve, and scheduled routines.
* **Main Flow:**
  1. User opens the dashboard.
  2. System displays the current mode, real-time clock, current brightness, today's schedule list, and live 24-hour rhythm chart in under 2 seconds.

### UC-06 — View Activity History
* **Actor:** User
* **Goal:** Review audit logs of light transitions, user updates, and system activities.
* **Main Flow:**
  1. System records every light change, routine alteration, schedule modification, and user login.
  2. User browses, filters, or exports the history log.
