## ADDED Requirements

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
