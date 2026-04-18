## ADDED Requirements

### Requirement: Cancellable script runs
The system SHALL retain an in-process handle for every spawned Step-1 and Step-2 child process, keyed by the owning `script_runs.id`. An admin SHALL be able to cancel any run whose `status` is `running` via `POST /api/projects/:id/script-runs/:runId/stop`. On cancellation, the server MUST send `SIGTERM` to the child; if the child has not exited within 5 seconds, the server MUST send `SIGKILL`.

#### Scenario: Admin cancels a running Step-2 child
- **WHEN** admin issues `POST /api/projects/1/script-runs/42/stop` while run 42 has `status = 'running'` and an active child process
- **THEN** the server sends SIGTERM to that child, updates run 42's `status` to `'cancelled'` once the child exits, appends `[cancelled by admin]` to the run log, and responds with `200 { ok: true }`

#### Scenario: Cancel request arrives after child already exited
- **WHEN** admin issues a stop request but the child process has already exited normally between the DB read and the signal call
- **THEN** the server does not raise; if the run row is still `running` it is finalized with its natural terminal status, otherwise the existing terminal status is preserved and the endpoint responds with `200 { ok: true, alreadyFinished: true }`

#### Scenario: Cancel request for a non-running row
- **WHEN** admin issues a stop request for a run whose status is already `success`, `error`, or `cancelled`
- **THEN** the server responds with `409 Conflict` and does not modify the row

### Requirement: Cancelled status is a distinct terminal state
The `script_runs.status` column SHALL support a `'cancelled'` value in addition to `'running'`, `'success'`, and `'error'`. The MikroORM `ScriptRunStatus` enum and its check constraint MUST both include this value. Cancelled rows MUST set `finished_at` to the cancellation timestamp.

#### Scenario: Cancelled row persisted
- **WHEN** a run is cancelled by the admin
- **THEN** the `script_runs` row has `status = 'cancelled'`, `finished_at` set to the moment the child exited, and the log contains the appended cancellation marker

### Requirement: Cancellation propagates to chained Step-2 bulk loop
When an admin cancels a Step-1 run that is currently inside its auto-chained Step-2 bulk phase, the server SHALL stop the Step-2 loop before it spawns the next per-notice child. Any Step-2 child already running at the moment of cancellation MUST be terminated using the same SIGTERM→SIGKILL sequence.

#### Scenario: Cancel Step-1 during chained bulk Step-2
- **WHEN** admin cancels Step-1 run 42 while it is iterating over pending notices for chained Step-2
- **THEN** the currently running Step-2 child is terminated, the chained loop does not start a new Step-2 child, and Step-1 run 42 finalizes with `status = 'cancelled'`

### Requirement: Stop action available in run history UI
The project dashboard's run history row SHALL render a "Stop" button whenever `status === 'running'`. Clicking the button SHALL call the cancel endpoint, disable the button while the request is in flight, and invalidate the run history query so the row updates to `cancelled`.

#### Scenario: Operator clicks Stop on a running row
- **WHEN** operator clicks the Stop button on a run with `status = 'running'`
- **THEN** the UI issues `POST /api/projects/:id/script-runs/:runId/stop`, shows a pending state on the button, and refreshes to show the `cancelled` badge once the server responds

#### Scenario: Stop button hidden on terminal rows
- **WHEN** a run row has `status` of `success`, `error`, or `cancelled`
- **THEN** the Stop button is not rendered for that row
