# Notice Details Specification

## Purpose

Step-2 execution (per-notice and bulk) to collect full notice details, with skip rules and run logging.

## Requirements

### Requirement: Per-notice Step-2 execution
The system SHALL allow the admin to trigger `step2-collect-details.js` for a single notice that is not `rejected` and not yet `details_collected`.

#### Scenario: Admin collects details for one notice
- **WHEN** admin clicks "Собрать информацию" on a notice row with status `new`
- **THEN** the backend spawns Step 2 for that notice ID, captures output, and updates the notice record with collected details and status `details_collected`

### Requirement: Bulk Step-2 execution
The system SHALL allow the admin to trigger Step 2 for all notices that are not `rejected` and not `details_collected` in a single action.

#### Scenario: Admin bulk-collects details
- **WHEN** admin clicks "Собрать информацию для всех"
- **THEN** the backend runs Step 2 for every notice with `status = 'new'` (sequentially or with configurable concurrency) and updates each record on completion

### Requirement: Step-2 skip conditions
The system SHALL skip running Step 2 for any notice with `status = 'rejected'` or `status = 'details_collected'`.

#### Scenario: Attempt to collect details for rejected notice
- **WHEN** Step 2 is triggered (bulk or single) for a notice with `status = 'rejected'`
- **THEN** the notice is skipped and no script run is created for it

### Requirement: Step-2 run log
The system SHALL record each Step-2 execution in `script_runs` with the associated notice ID, start time, end time, exit code, and log output.

#### Scenario: Step 2 fails for a notice
- **WHEN** the step-2 child process exits with a non-zero code
- **THEN** the notice `status` is updated to `error` and the `script_runs` row records `status = 'error'` with captured stderr

### Requirement: Step-2 detail write via managed Notice entity
The system SHALL persist Step-2 results by loading the target `Notice` as a managed MikroORM entity, assigning the `details` JSON payload and `status = 'details_collected'`, then flushing. The status transition and JSON shape MUST match the drizzle behavior.

#### Scenario: Step 2 succeeds for a single notice
- **WHEN** `runner/runs.ts::runStep2ForNotice` completes with exit code 0
- **THEN** a forked `EntityManager` loads the `Notice`, sets `details` to the parsed payload and `status = 'details_collected'`, and commits with `em.flush()`

#### Scenario: Step 2 fails within unit-of-work
- **WHEN** the Step-2 child process exits with a non-zero code
- **THEN** the same forked EM sets `status = 'error'` on the `Notice` and persists a `ScriptRun` entity with `status = 'error'` and the captured stderr in the same unit-of-work

### Requirement: Step-2 skip rules enforced in-memory
The system SHALL check `status` on the loaded `Notice` entity before spawning Step-2 and skip the run (without creating a `ScriptRun`) when the status is `'rejected'` or `'details_collected'`.

#### Scenario: Bulk Step-2 skips ineligible notices
- **WHEN** `runStep2Bulk` iterates over project notices
- **THEN** entities with `status` in (`'rejected'`, `'details_collected'`) are filtered out via the EntityManager query, and no child process is spawned for them

### Requirement: Bulk Step-2 is invoked automatically after Step-1
The system SHALL accept an automatic caller (the Step-1 runner) as a valid trigger for bulk Step-2, in addition to the existing manual HTTP trigger. The automatic invocation MUST reuse `runStep2Bulk(projectId)` so that skip rules, per-notice `script_runs` creation, and managed-entity persistence are identical to a manual bulk click.

#### Scenario: Step-2 bulk invoked from Step-1 runner
- **WHEN** `runner/runs.ts::runStep1` finishes its keyword loop and calls `runStep2Bulk(projectId)`
- **THEN** the same code path that handles `POST /api/projects/:id/run/step2/bulk` executes, producing one `script_runs` row per eligible notice and flushing details as `details_collected`

#### Scenario: Skip rules apply identically under auto-invocation
- **WHEN** the auto-chained bulk encounters a notice with `status` in (`'rejected'`, `'details_collected'`)
- **THEN** the notice is skipped with no `script_runs` row created — matching the existing skip behavior

#### Scenario: Manual bulk trigger remains available
- **WHEN** admin clicks "Собрать информацию для всех" after the auto-chain has already run
- **THEN** the existing `POST /api/projects/:id/run/step2/bulk` endpoint processes any notices still in `status = 'new'` (for example, notices that errored during the auto-chain) and creates fresh `script_runs` rows
