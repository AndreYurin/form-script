## ADDED Requirements

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
