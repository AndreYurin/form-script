## ADDED Requirements

### Requirement: Atomic notice sync via MikroORM unit-of-work
The system SHALL persist Step-1 results through a single MikroORM unit-of-work: one forked `EntityManager` per sync, all notice upserts staged on the identity map, and one `em.flush()` call that commits the batch transactionally. The "do not overwrite `rejected` or `details_collected`" rule MUST be enforced in memory before mutation.

#### Scenario: Step 1 sync batches upserts in one flush
- **WHEN** the runner finishes a Step-1 execution and calls `sync.ts`
- **THEN** `sync.ts` forks an `EntityManager`, loads existing `Notice` entities for the project, stages inserts/updates on the identity map, and commits them with a single `em.flush()`

#### Scenario: Sync preserves rejected and details_collected statuses
- **WHEN** Step-1 output includes a notice ID whose persisted entity has `status = 'rejected'` or `status = 'details_collected'`
- **THEN** the sync leaves that entity unchanged and does not include it in the flushed writes

### Requirement: Notice entity models project relation
The system SHALL model `Notice` as a MikroORM entity with a `@ManyToOne(() => Project)` relation and preserve the `(project_id, notice_id)` unique constraint at the database level.

#### Scenario: Duplicate notice within a project rejected
- **WHEN** the sync attempts to insert a `Notice` whose `(project, noticeId)` pair already exists
- **THEN** the database unique constraint rejects the insert and the existing entity is updated instead
