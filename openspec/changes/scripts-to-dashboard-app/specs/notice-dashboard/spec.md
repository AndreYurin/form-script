## ADDED Requirements

### Requirement: Notice table
The system SHALL display all notices for the active project in a paginated table. Each row MUST show: notice ID, organizer name, announcement title, status badge, collected-at timestamp, and action buttons.

#### Scenario: Admin views Project 1 notices
- **WHEN** admin opens the Project 1 dashboard
- **THEN** a table lists all notices from the `notices` table with their current status

#### Scenario: Table reflects real-time status after script run
- **WHEN** a Step-1 or Step-2 run completes
- **THEN** the table refreshes (poll interval ≤ 5 s) and shows the updated statuses without a full page reload

### Requirement: Mark notice as "Не подходит"
The system SHALL allow the admin to mark any notice (except those already `rejected`) as not relevant.

#### Scenario: Admin rejects a notice
- **WHEN** admin clicks "Не подходит" on a notice row
- **THEN** the notice `status` is updated to `rejected` in the database and the row's status badge updates to "Не подходит"

#### Scenario: Rejected notice cannot be collected
- **WHEN** a notice has `status = 'rejected'`
- **THEN** the "Собрать информацию" button is disabled or hidden for that row

### Requirement: Notice detail view
The system SHALL allow the admin to expand or navigate to a notice to see all collected detail fields (all fields stored in the notice record).

#### Scenario: Admin views full notice details
- **WHEN** admin clicks on a notice row or an "expand" control
- **THEN** all available fields (e.g., deadline, amount, description, contact info) are displayed

### Requirement: Bulk "Собрать информацию" button
The system SHALL show a prominent "Собрать информацию для всех" button above the table that triggers bulk Step-2 for all unprocessed notices.

#### Scenario: Bulk action button state
- **WHEN** there are no notices with `status = 'new'`
- **THEN** the bulk button is disabled
