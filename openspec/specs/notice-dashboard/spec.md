# Notice Dashboard Specification

## Purpose

Per-project admin dashboard listing notices with status, detail view, reject action, and bulk Step-2 trigger.

## Requirements

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

### Requirement: Notice listing via MikroORM EntityManager
The system SHALL serve the paginated notice list through `EntityManager.findAndCount` on the `Notice` entity, using the request-scoped EM installed by `RequestContext` middleware. The response shape (items, total, page, limit) MUST remain identical to the drizzle implementation.

#### Scenario: Paginated notice list for a project
- **WHEN** the client calls `GET /api/projects/:id/notices?page=1&limit=50`
- **THEN** the handler uses the request-scoped EM to call `em.findAndCount(Notice, { project: id }, { limit, offset, orderBy: { collectedAt: 'DESC' } })` and returns the same JSON envelope as before

#### Scenario: Status filter preserved
- **WHEN** the client includes `?status=new` in the request
- **THEN** the EntityManager query adds `{ status: 'new' }` to the filter and returns only matching notices

### Requirement: Reject action via managed entity
The system SHALL implement "mark notice as rejected" by loading the managed `Notice` entity via the request-scoped EM, mutating `status` to `'rejected'`, and flushing — replacing the prior drizzle `update().set().where()` call.

#### Scenario: Admin rejects a notice via EM
- **WHEN** the client calls `PATCH /api/projects/:id/notices/:noticeId/reject`
- **THEN** the handler loads the `Notice` via the request-scoped EM, sets `status = 'rejected'`, and calls `em.flush()` within the request context
