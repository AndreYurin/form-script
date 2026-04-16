## ADDED Requirements

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
