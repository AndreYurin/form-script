# Cron Scheduler Specification

## Purpose

Per-project cron scheduling for Step-1 auto-runs, configured via UI, persisted in the database, and restored on server restart.

## Requirements

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

### Requirement: Cron fields persisted on Project entity
The system SHALL store `cronExpression` and `cronEnabled` as properties on the MikroORM `Project` entity, mapped to the existing `cron_expression` and `cron_enabled` columns. Updates from `PATCH /api/projects/:id/cron` MUST mutate the managed entity and flush through the request-scoped `EntityManager`.

#### Scenario: Admin updates cron expression
- **WHEN** the client calls `PATCH /api/projects/:id/cron` with a new expression
- **THEN** the handler loads the `Project` via the request-scoped EM, assigns `cronExpression` and `cronEnabled`, calls `em.flush()`, and then calls the cron scheduler to reschedule the job without restarting the server

#### Scenario: Admin toggles autorun off
- **WHEN** the client sets `cronEnabled = false`
- **THEN** the same mutation path flushes the entity and the scheduler destroys the active `node-cron` job for that project

### Requirement: Scheduler bootstrap reads via forked EM
The system SHALL restore cron jobs at server start by forking an `EntityManager` from the bootstrap `MikroORM` instance, loading all `Project` entities with `cronEnabled = true`, and registering one `node-cron` job per project.

#### Scenario: Server restart re-registers schedules
- **WHEN** the Express process starts
- **THEN** `cron/scheduler.ts` forks an EM, calls `em.find(Project, { cronEnabled: true })`, and registers a `node-cron` job per returned entity using its `cronExpression`

### Requirement: Cron callbacks fork their own EntityManager
The system SHALL ensure each cron tick runs inside its own forked `EntityManager` (not the global one), so concurrent schedules and HTTP requests never share an identity map.

#### Scenario: Cron tick triggers Step 1
- **WHEN** a scheduled cron expression fires
- **THEN** the callback forks a fresh `EntityManager` via `orm.em.fork()`, runs the Step-1 trigger and sync inside `em.transactional(...)`, and releases the EM when the transaction commits
