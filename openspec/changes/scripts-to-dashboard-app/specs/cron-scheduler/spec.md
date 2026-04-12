## ADDED Requirements

### Requirement: Cron configuration UI
The system SHALL allow the admin to view and edit the cron expression for each project's Step-1 auto-run schedule.

#### Scenario: Admin views current schedule
- **WHEN** admin opens the Project settings / cron section
- **THEN** the current cron expression and a human-readable description (e.g., "Every day at 08:00") are displayed

#### Scenario: Admin updates cron expression
- **WHEN** admin edits the cron expression field and saves
- **THEN** the new expression is persisted to the `projects.cron_expression` column and the in-process `node-cron` job is rescheduled without restarting the server

#### Scenario: Invalid cron expression rejected
- **WHEN** admin enters an invalid cron string
- **THEN** the UI shows a validation error and the save is blocked

### Requirement: Cron persistence across server restarts
The system SHALL restore the active cron schedule from the database when the Express server starts.

#### Scenario: Server restarts with saved schedule
- **WHEN** the Express process starts
- **THEN** it reads `projects.cron_expression` for each project and registers the corresponding `node-cron` jobs

### Requirement: Cron can be disabled
The system SHALL allow disabling the automatic schedule without deleting the expression.

#### Scenario: Admin disables the schedule
- **WHEN** admin toggles "Автозапуск" off
- **THEN** the cron job is paused (or destroyed) and no automatic Step-1 runs occur until re-enabled
