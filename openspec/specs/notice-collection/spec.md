# Notice Collection Specification

## Purpose

Step-1 script execution (manual and scheduled) to discover notice IDs from target sites, persist them to Postgres, and log run outcomes.

## Requirements

### Requirement: Step-1 script execution
The system SHALL execute the `step1-collect-ids.js` script (equivalent to `node index.js --step1`) on demand and on the configured cron schedule. Results MUST be persisted to the `notices` Postgres table.

#### Scenario: Admin triggers Step 1 manually
- **WHEN** admin clicks "Запустить Step 1" in the dashboard
- **THEN** the backend spawns the step-1 script, captures its output, and upserts found notice IDs into the `notices` table with status `new`

#### Scenario: Step 1 runs on schedule
- **WHEN** the configured cron expression fires
- **THEN** the backend automatically runs Step 1 without admin interaction and upserts results into `notices`

### Requirement: Rejected notices are not re-inserted
The system SHALL NOT change the status of a notice that has `status = 'rejected'` when Step 1 runs again.

#### Scenario: Previously rejected notice found again by Step 1
- **WHEN** Step 1 finds a notice ID that already exists in `notices` with `status = 'rejected'`
- **THEN** the record is left unchanged (status remains `rejected`)

### Requirement: Step-1 run log
The system SHALL record each Step-1 execution in a `script_runs` table with start time, end time, exit code, and captured stdout/stderr.

#### Scenario: Step 1 completes successfully
- **WHEN** the step-1 child process exits with code 0
- **THEN** a `script_runs` row is created with `status = 'success'` and the captured log output

### Requirement: Atomic notice sync via MikroORM unit-of-work
The system SHALL persist Step-1 results through a single MikroORM unit-of-work: one forked `EntityManager` per sync, all notice upserts staged on the identity map, and one `em.flush()` call that commits the batch transactionally. The "do not overwrite `rejected` or `details_collected`" rule MUST be enforced in memory before mutation.

#### Scenario: Step 1 sync batches upserts in one flush
- **WHEN** the runner finishes a Step-1 execution and calls `sync.ts`
- **THEN** `sync.ts` forks an `EntityManager`, loads existing `Notice` entities for the project, stages inserts/updates on the identity map, and commits them with a single `em.flush()`

#### Scenario: Sync preserves rejected and details_collected statuses
- **WHEN** Step-1 output includes a notice ID whose persisted entity has `status = 'rejected'` or `status = 'details_collected'`
- **THEN** the sync leaves that entity unchanged and does not include it in the flushed writes

### Requirement: Notice entity models project relation
The system SHALL model `Notice` as a MikroORM entity with a `@ManyToOne(() => Project)` relation and preserve the `(project_id, notice_id)` unique constraint at the database level.

#### Scenario: Duplicate notice within a project rejected
- **WHEN** the sync attempts to insert a `Notice` whose `(project, noticeId)` pair already exists
- **THEN** the database unique constraint rejects the insert and the existing entity is updated instead
