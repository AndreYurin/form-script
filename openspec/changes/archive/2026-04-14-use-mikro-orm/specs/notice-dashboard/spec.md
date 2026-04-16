## ADDED Requirements

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

#### Scenario: Admin rejects a notice
- **WHEN** the client calls `PATCH /api/projects/:id/notices/:noticeId/reject`
- **THEN** the handler loads the `Notice` via the request-scoped EM, sets `status = 'rejected'`, and calls `em.flush()` within the request context
