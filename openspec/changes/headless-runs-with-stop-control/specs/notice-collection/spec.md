## ADDED Requirements

### Requirement: Step-1 runs headless by default
The `step1-collect-ids.js` child process SHALL launch Chromium in headless mode by default. The runner MUST NOT pass any flag that re-enables headed mode unless explicitly requested for debugging. The headed-auth flow (`POST /api/projects/:id/authorize`) is unaffected and continues to open a visible browser.

#### Scenario: Scheduled Step-1 run on a headless host
- **WHEN** the cron tick fires on a server with no display
- **THEN** `step1-collect-ids.js` spawns Chromium in headless mode, completes the keyword loop, and produces matched IDs without requiring a display

#### Scenario: Manual Step-1 run does not steal focus
- **WHEN** admin clicks "Запустить Step 1" on a desktop
- **THEN** no Chromium window is shown; stdout/stderr are still captured to the `script_runs` log

### Requirement: Step-1 is cancellable mid-flight
The Step-1 runner SHALL honour an in-process cancellation flag set by the run-control capability. When a cancellation is requested during Step-1 execution, the runner MUST terminate the currently-spawned child, skip all remaining keyword iterations, skip the auto-chained Step-2 bulk phase, and finalize the Step-1 `script_runs` row with `status = 'cancelled'`.

#### Scenario: Admin cancels Step-1 between keywords
- **WHEN** Step-1 has completed keyword "школа" and is about to start "гимназия", and admin cancels the run
- **THEN** the runner does not spawn the "гимназия" child, does not invoke chained Step-2 bulk, and finalizes the row with `status = 'cancelled'`

#### Scenario: Admin cancels Step-1 while a keyword child is running
- **WHEN** admin cancels Step-1 while the "школа" child process is mid-execution
- **THEN** the child receives SIGTERM (and SIGKILL after the grace window if needed), any notices already written up to that point remain in the database, remaining keywords are not processed, chained Step-2 bulk is not invoked, and the row finalizes as `cancelled`
