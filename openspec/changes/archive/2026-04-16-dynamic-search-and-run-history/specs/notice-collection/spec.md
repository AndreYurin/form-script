## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Sync module accepts search keyword parameter
The `sync.ts` module SHALL accept an optional `searchKeyword` parameter. When provided, each notice upserted in that sync call SHALL have its `search_keyword` column set to this value.

#### Scenario: Sync called with keyword
- **WHEN** `sync.ts` is called with `searchKeyword = "лицей"`
- **THEN** every notice inserted or updated in that call has `search_keyword = "лицей"`

#### Scenario: Sync called without keyword (legacy path)
- **WHEN** `sync.ts` is called without `searchKeyword`
- **THEN** `search_keyword` on affected rows is left unchanged (null for new rows)
