## Use Cases

### UC-01 — Manage Daily Light Schedule

* **ID:** UC-01
* **Name:** Manage Daily Light Schedule
* **Actor:** User
* **Goal:** Set and manage a daily light schedule based on time.
* **Pre-condition:** The user can access the Light Rhythm Management System.
* **Main Flow:**

  1. User sets a daily light schedule based on time.
  2. System records the schedule.
  3. System manages the light according to the schedule.
* **Alternative Flow:** User changes the daily light schedule, and the system manages the updated schedule.
* **Exception Flow:** If the schedule cannot be recorded, the schedule is not saved.
* **Post-condition:** The daily light schedule is set or updated.

### UC-02 — Adjust Light Brightness

* **ID:** UC-02
* **Name:** Automatic Light Brightness Adjustment
* **Actor:** User
* **Goal:** Have light brightness automatically adjusted for morning, day, and night.
* **Pre-condition:** A time-based light schedule is available.
* **Main Flow:**

  1. System identifies the applicable time of day.
  2. System adjusts the light brightness for morning, day, or night.
* **Alternative Flow:** The system applies the brightness adjustment for the applicable time period.
* **Exception Flow:** If the applicable time period cannot be determined, the brightness adjustment cannot be performed.
* **Post-condition:** Light brightness is adjusted according to the time of day.

### UC-03 — Manage Light Routines

* **ID:** UC-03
* **Name:** Create and Edit Light Routines
* **Actor:** User
* **Goal:** Create and edit light routines.
* **Pre-condition:** The user can access the system.
* **Main Flow:**

  1. User creates a light routine.
  2. System records the routine.
  3. User can edit the light routine.
  4. System records the updated routine.
* **Alternative Flow:** User edits an existing routine without creating a new one.
* **Exception Flow:** If the routine cannot be recorded, the change is not saved.
* **Post-condition:** The light routine is created or updated.

### UC-04 — Store Settings and Schedules

* **ID:** UC-04
* **Name:** Store User Settings and Schedules
* **Actor:** User
* **Goal:** Save user settings and schedules in SQLite.
* **Pre-condition:** User settings or schedules are available to be stored.
* **Main Flow:**

  1. User creates or changes settings or schedules.
  2. System stores the settings or schedules in SQLite.
* **Alternative Flow:** Updated settings or schedules replace the previously stored values.
* **Exception Flow:** If SQLite cannot store the data, the changes are not saved.
* **Post-condition:** User settings and schedules are stored in SQLite.

### UC-05 — View Light Dashboard

* **ID:** UC-05
* **Name:** View Current Light Mode and Schedule
* **Actor:** User
* **Goal:** View the current light mode and schedule.
* **Pre-condition:** The dashboard is available.
* **Main Flow:**

  1. User opens the dashboard.
  2. System displays the current light mode.
  3. System displays the current light schedule.
* **Alternative Flow:** User views the dashboard again to see the current information.
* **Exception Flow:** If the current light information cannot be displayed, the dashboard cannot show the required information.
* **Post-condition:** User can view the current light mode and schedule.

### UC-06 — View Activity History

* **ID:** UC-06
* **Name:** Keep History of Light Changes and User Activity
* **Actor:** User
* **Goal:** Keep a history of light changes and user activity.
* **Pre-condition:** Light changes or user activity have occurred.
* **Main Flow:**

  1. System records light changes and user activity.
  2. System keeps the recorded history.
  3. User views the recorded history.
* **Alternative Flow:** The system records additional light changes or user activity as they occur.
* **Exception Flow:** If the history cannot be recorded, the new activity is not added to the history.
* **Post-condition:** The history of recorded light changes and user activity is maintained.
