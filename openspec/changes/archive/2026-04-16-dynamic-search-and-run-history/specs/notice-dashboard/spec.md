## MODIFIED Requirements

### Requirement: Notice table
The system SHALL display all notices for the active project in a paginated table. Each row MUST show: notice ID, organizer name, announcement title, **search keyword**, status badge, collected-at timestamp, and action buttons.

#### Scenario: Admin views Project 1 notices
- **WHEN** admin opens the Project 1 dashboard
- **THEN** a table lists all notices from the `notices` table with their current status and the "Ключевое слово" column visible

#### Scenario: Table reflects real-time status after script run
- **WHEN** a Step-1 or Step-2 run completes
- **THEN** the table refreshes (poll interval ≤ 5 s) and shows the updated statuses without a full page reload

#### Scenario: Notice with null search_keyword
- **WHEN** a notice has `search_keyword = null` (imported before this feature)
- **THEN** the "Ключевое слово" cell displays "—"
