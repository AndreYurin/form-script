# Project Management Specification

## Purpose

Multi-project registry and navigation — each project represents a scraping target with its own dashboard, schedule, and scripts.

## Requirements

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

### Requirement: Project persistence via MikroORM entity
The system SHALL persist projects as a MikroORM `Project` entity mapped to the existing `projects` table. All project reads and writes MUST go through a MikroORM `EntityManager` (request-scoped for HTTP handlers, explicitly forked for cron and bootstrap code paths).

#### Scenario: Route handler loads project via request-scoped EM
- **WHEN** a request hits `GET /api/projects/:id`
- **THEN** the handler resolves the project through the request-scoped `EntityManager` provided by `RequestContext` middleware and returns the same JSON shape as before

#### Scenario: Seed uses bootstrap EM
- **WHEN** `db:seed` runs on a fresh database
- **THEN** the seed script obtains a forked `EntityManager` from the bootstrap `MikroORM` instance and persists the pre-seeded "goszakup – Госзакупки" `Project` entity

### Requirement: Baseline migration recreates projects schema
The system SHALL provide a single baseline MikroORM migration that recreates the `projects` table (columns, primary key, and defaults) equivalent to the retired drizzle migration.

#### Scenario: Fresh database after cutover
- **WHEN** a developer runs `docker compose down -v && docker compose up -d` followed by `npm run --workspace server migrate`
- **THEN** the `projects` table is created by the MikroORM baseline migration with the same columns the drizzle schema defined
