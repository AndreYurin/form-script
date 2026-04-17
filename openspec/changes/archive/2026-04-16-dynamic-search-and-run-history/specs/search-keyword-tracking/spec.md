## ADDED Requirements

### Requirement: Each notice stores the keyword that produced it
The `notices` table SHALL have a `search_keyword text nullable` column. When a notice is upserted by the sync module, the `search_keyword` value SHALL be set to the keyword used in the step-1 run that collected it.

#### Scenario: Notice upserted with keyword
- **WHEN** the sync module processes results from a run with keyword "гимназия"
- **THEN** all notices upserted in that sync have `search_keyword = "гимназия"`

#### Scenario: Existing notice re-encountered with a different keyword
- **WHEN** a notice already in the DB (from keyword "школа") is encountered again during a run with keyword "гимназия"
- **THEN** the `search_keyword` is updated to "гимназия" (last-write wins on upsert)

#### Scenario: Historical notices imported before this feature
- **WHEN** notices were imported via `db:migrate-json` before this feature was deployed
- **THEN** their `search_keyword` column is `null` and they appear normally in the UI without a keyword badge

### Requirement: Notice list API and UI expose search keyword
The `GET /api/projects/:id/notices` response SHALL include a `searchKeyword` field on each notice row. The notices table in the UI SHALL display a "Ключевое слово" column showing the keyword or "—" if null.

#### Scenario: Notices table shows keyword column
- **WHEN** the notices table is rendered
- **THEN** a "Ключевое слово" column is visible with the keyword value for each row that has one
