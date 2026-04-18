# Notice Collection Specification

## Purpose

Step-1 script execution (manual and scheduled) to discover notice IDs from target sites, persist them to Postgres, and log run outcomes.

## Requirements

### Requirement: Step-1 script execution
The system SHALL execute the `step1-collect-ids.js` script once per configured search keyword, sequentially, on demand and on the configured cron schedule. Each execution SHALL pass the keyword via `--keyword <text>` CLI argument. Results from all keyword runs MUST be persisted to the `notices` Postgres table within the same step-1 `script_runs` row.

#### Scenario: Admin triggers Step 1 manually — multiple keywords
- **WHEN** admin clicks "Запустить Step 1" and the project has keywords `["школа", "гимназия"]`
- **THEN** the backend runs the script with `--keyword "школа"` first, waits for it to finish, then runs with `--keyword "гимназия"`, upserts all found IDs into `notices` with `search_keyword` set accordingly, all under one `script_runs` row

#### Scenario: Admin triggers Step 1 — no keywords configured
- **WHEN** admin clicks "Запустить Step 1" and `search_keywords` is empty
- **THEN** the backend does NOT start any script run and responds with an error message indicating that search keywords must be configured first

#### Scenario: Step 1 runs on schedule
- **WHEN** the configured cron expression fires
- **THEN** the backend automatically runs Step 1 for all configured keywords sequentially and upserts results into `notices`

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

### Requirement: Sync module accepts search keyword parameter
The `sync.ts` module SHALL accept an optional `searchKeyword` parameter. When provided, each notice upserted in that sync call SHALL have its `search_keyword` column set to this value.

#### Scenario: Sync called with keyword
- **WHEN** `sync.ts` is called with `searchKeyword = "лицей"`
- **THEN** every notice inserted or updated in that call has `search_keyword = "лицей"`

#### Scenario: Sync called without keyword (legacy path)
- **WHEN** `sync.ts` is called without `searchKeyword`
- **THEN** `search_keyword` on affected rows is left unchanged (null for new rows)

### Requirement: Notice entity models project relation
The system SHALL model `Notice` as a MikroORM entity with a `@ManyToOne(() => Project)` relation and preserve the `(project_id, notice_id)` unique constraint at the database level.

#### Scenario: Duplicate notice within a project rejected
- **WHEN** the sync attempts to insert a `Notice` whose `(project, noticeId)` pair already exists
- **THEN** the database unique constraint rejects the insert and the existing entity is updated instead

### Requirement: Step-2 auto-chain after Step-1 completion
The system SHALL automatically invoke a bulk Step-2 run immediately after the Step-1 keyword loop finalizes, covering every notice in the project whose `status` is `'new'`. Step 2 SHALL run regardless of whether all Step-1 keywords succeeded, so that notices collected by successful keywords are enriched even if a sibling keyword failed. Failures inside the chained Step-2 phase MUST NOT change the Step-1 `ScriptRun` row's terminal `status`; they MUST be appended to the Step-1 `log` so they remain discoverable.

#### Scenario: Manual Step-1 chains into Step-2
- **WHEN** admin triggers `POST /api/projects/:id/run/step1` and the project has keywords `["школа", "лицей"]`
- **THEN** after the keyword loop completes, the runner invokes `runStep2Bulk(projectId)` and produces one `script_runs` row per eligible notice with `scriptName = 'step2'`, in addition to the single Step-1 `script_runs` row

#### Scenario: Scheduled Step-1 chains into Step-2
- **WHEN** the node-cron tick fires and runs Step-1 for the project
- **THEN** the same scheduled invocation proceeds to Step-2 bulk for all `status = 'new'` notices before returning control to the scheduler

#### Scenario: Step-1 partial failure still triggers Step-2
- **WHEN** Step-1 finishes with `overallSuccess = false` because one keyword's collection failed but others produced notices
- **THEN** the runner still invokes `runStep2Bulk(projectId)` and the Step-1 `script_runs` row is finalized with `status = 'error'` without being reopened by the chained Step-2 outcome

#### Scenario: Step-2 auto-chain errors recorded in Step-1 log
- **WHEN** the chained `runStep2Bulk` call throws or individual per-notice Step-2 runs fail
- **THEN** the runner appends a human-readable error line to the Step-1 `ScriptRun.log` and does not rethrow, so the Step-1 caller (HTTP handler or cron) still receives the finalized Step-1 row
