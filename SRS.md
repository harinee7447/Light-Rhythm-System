# Software Requirements Specification (SRS)
## Light Rhythm Management System

## 1. Purpose and Scope

### Purpose
The purpose of the Light Rhythm Management System is to manage daily light schedules, adjust light brightness according to different times of day, manage light routines, store settings and schedules, display the current light status, and maintain activity history.

### In Scope
* Daily light schedules based on time.
* Automatic brightness adjustment for morning, day, and night.
* Creating and editing light routines.
* Storing user settings and schedules using SQLite.
* Dashboard showing current light mode and schedule.
* History of light changes and user activity.

### Out of Scope
* Features not listed in the requirements above.

---

## 2. Functional Requirements

* **FR-01:** The system shall set and manage daily light schedules based on time.
* **FR-02:** The system shall automatically adjust light brightness for morning, day, and night.
* **FR-03:** The system shall allow users to create and edit light routines.
* **FR-04:** The system shall store user settings and schedules in SQLite.
* **FR-05:** The system shall show the current light mode and schedule on a dashboard.
* **FR-06:** The system shall keep a history of light changes and user activity.

---

## 3. Non-Functional Requirements

* **NFR-01:** The system shall display the dashboard within **2 seconds** of a user request.
* **NFR-02:** The system shall store passwords and other sensitive user data using **secure hashing**.
* **NFR-03:** The system shall allow a new user to complete a routine-setting task within **3 minutes**.
* **NFR-04:** The system shall maintain **99% availability** during normal project testing.
* **NFR-05:** The system shall save each valid schedule or routine change to SQLite within **2 seconds**.
* **NFR-06:** The system shall prevent unauthorized users from accessing protected settings with **100% authentication checks**.

---

## 4. Assumptions

* The system will be developed using Python.
* SQLite will be used as the database.
* Users have access to a computer or device capable of running the Python application.
* The required light-control environment is available for testing.
* System time is available for schedule-based operation.

---

## 5. Constraints

* The first version must use Python as the main programming language.
* The first version must use SQLite for data storage.
* The project must remain small enough to develop within a few weeks.
* The system is limited to the six specified features.
* The first version does not include features outside the stated requirements.
