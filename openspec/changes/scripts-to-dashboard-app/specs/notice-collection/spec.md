## ADDED Requirements

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
