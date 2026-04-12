## ADDED Requirements

### Requirement: Project list
The system SHALL maintain a list of projects in the database. Each project has a unique ID, a human-readable name, a description, a target URL, and a cron expression.

#### Scenario: Admin views project list
- **WHEN** admin opens the application root
- **THEN** a sidebar/tab list shows all configured projects

#### Scenario: Project 1 is pre-seeded
- **WHEN** the server runs database migrations for the first time
- **THEN** a project record named "goszakup – Госзакупки" is present in the `projects` table

### Requirement: Project detail navigation
The system SHALL allow the admin to open any project and see its dedicated dashboard.

#### Scenario: Admin opens Project 1
- **WHEN** admin clicks on "goszakup – Госзакупки" in the project list
- **THEN** the dashboard switches to the Project 1 view showing notices, cron config, and script docs sections
