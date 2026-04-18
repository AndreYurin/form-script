## MODIFIED Requirements

### Requirement: Notice table
The system SHALL display all notices for the active project in a paginated table. Each row MUST show the following primary columns in this order: **ID** (linked to the notice's source URL), **Название** (clickable to open the in-app detail view), **Организатор**, **Сумма**, **Дата завершения**. Secondary metadata — `status`, `collected-at` timestamp, and `search_keyword` — MUST NOT occupy their own columns; they MUST be accessible through the row's overflow (3-dot) menu in the rightmost column. The rightmost column SHALL also host the row-level action buttons "Заполнить" and "Не подходит".

#### Scenario: Admin views Project 1 notices
- **WHEN** admin opens the Project 1 dashboard
- **THEN** a table lists all notices from the `notices` table with columns ID, Название, Организатор, Сумма, Дата завершения, and a rightmost actions column; there is no dedicated column for status, collected-at, or search keyword

#### Scenario: Table reflects real-time status after script run
- **WHEN** a Step-1 or Step-2 run completes
- **THEN** the table refreshes (poll interval ≤ 5 s) and shows the updated Сумма / Дата завершения values and the new status (visible via the overflow menu) without a full page reload

#### Scenario: Notice with missing Step-2 details
- **WHEN** a notice has `status = 'new'` (Step 2 not yet run for it) or `details` is missing the corresponding field
- **THEN** the **Сумма** and **Дата завершения** cells display "—" rather than empty strings or errors

#### Scenario: Notice with null search_keyword
- **WHEN** a notice has `search_keyword = null` (imported before this feature)
- **THEN** the overflow menu displays "—" for the keyword field

### Requirement: Mark notice as "Не подходит"
The system SHALL allow the admin to mark any notice (except those already `rejected`) as not relevant via a row-level "Не подходит" button retained alongside "Заполнить".

#### Scenario: Admin rejects a notice
- **WHEN** admin clicks "Не подходит" on a notice row
- **THEN** the notice `status` is updated to `rejected` in the database and the row's status entry in the overflow menu updates to "Не подходит"

#### Scenario: Rejected notice cannot be re-filled
- **WHEN** a notice has `status = 'rejected'`
- **THEN** the "Заполнить" button on that row is disabled

## ADDED Requirements

### Requirement: Per-row Step-2 action labelled "Заполнить"
The system SHALL present the per-row Step-2 trigger with the label "Заполнить" (replacing the legacy "Собрать" label) while preserving the existing behavior of invoking `POST /api/projects/:id/notices/:noticeId/collect`. The button MUST be disabled for notices with `status` in (`'rejected'`, `'details_collected'`). The label change SHALL NOT affect any API route or payload.

#### Scenario: Admin triggers per-notice fill
- **WHEN** admin clicks "Заполнить" on a notice row with `status = 'new'`
- **THEN** the frontend calls `POST /api/projects/:id/notices/:noticeId/collect` and the notice status transitions through the existing Step-2 flow

#### Scenario: Button disabled on already-filled or rejected notices
- **WHEN** a notice has `status = 'details_collected'` or `status = 'rejected'`
- **THEN** the "Заполнить" button is rendered in a disabled state and emits no request on click

### Requirement: ID cell links to source URL
The system SHALL render the notice ID cell as an anchor that opens the notice's goszakup.gov.kz announcement page in a new tab. The anchor's `href` SHALL be taken from `notice.details.url` when present; when absent, the frontend SHALL synthesize the fallback URL `https://goszakup.gov.kz/ru/announce/index/{noticeId}`. The anchor MUST use `target="_blank"` and `rel="noopener noreferrer"`.

#### Scenario: Step-2 collected — ID links to stored URL
- **WHEN** a notice has `details.url = "https://goszakup.gov.kz/ru/announce/index/123"`
- **THEN** clicking the ID opens that URL in a new browser tab

#### Scenario: Step-2 not yet run — ID uses fallback URL
- **WHEN** a notice has `details = null` or `details.url` missing
- **THEN** the ID link falls back to `https://goszakup.gov.kz/ru/announce/index/<notice.noticeId>` and still opens in a new tab

#### Scenario: Title click still opens in-app detail
- **WHEN** admin clicks the notice title (not the ID)
- **THEN** the in-app detail side-sheet opens and the external URL is NOT navigated

### Requirement: Row overflow menu exposes secondary metadata
The system SHALL expose a 3-dot overflow menu as the last element of each row, containing read-only items for **status** (with the existing badge styling), **Собрано** (formatted collected-at timestamp), and **Ключевое слово** (search keyword or "—"). The overflow menu MUST NOT contain action buttons — actions remain as visible buttons alongside it.

#### Scenario: Admin opens overflow for a collected notice
- **WHEN** admin clicks the 3-dot trigger on a row whose notice has `status = 'details_collected'`, `collectedAt = "2026-04-18T10:20:00Z"`, and `searchKeyword = "школа"`
- **THEN** the menu shows a status badge "собрано", "Собрано: 2026-04-18 10:20" (or locale-equivalent formatting used elsewhere in the app), and "Ключевое слово: школа"

#### Scenario: Overflow menu is read-only
- **WHEN** admin opens the overflow menu
- **THEN** no button inside triggers a mutation; the Заполнить and Не подходит actions remain in the row's action area outside the menu
