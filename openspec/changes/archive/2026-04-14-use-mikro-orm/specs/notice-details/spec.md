## ADDED Requirements

### Requirement: Step-2 detail write via managed Notice entity
The system SHALL persist Step-2 results by loading the target `Notice` as a managed MikroORM entity, assigning the `details` JSON payload and `status = 'details_collected'`, then flushing. The status transition and JSON shape MUST match the drizzle behavior.

#### Scenario: Step 2 succeeds for a single notice
- **WHEN** `runner/runs.ts::runStep2ForNotice` completes with exit code 0
- **THEN** a forked `EntityManager` loads the `Notice`, sets `details` to the parsed payload and `status = 'details_collected'`, and commits with `em.flush()`

#### Scenario: Step 2 fails for a notice
- **WHEN** the Step-2 child process exits with a non-zero code
- **THEN** the same forked EM sets `status = 'error'` on the `Notice` and persists a `ScriptRun` entity with `status = 'error'` and the captured stderr in the same unit-of-work

### Requirement: Step-2 skip rules enforced in-memory
The system SHALL check `status` on the loaded `Notice` entity before spawning Step-2 and skip the run (without creating a `ScriptRun`) when the status is `'rejected'` or `'details_collected'`.

#### Scenario: Bulk Step-2 skips ineligible notices
- **WHEN** `runStep2Bulk` iterates over project notices
- **THEN** entities with `status` in (`'rejected'`, `'details_collected'`) are filtered out via the EntityManager query, and no child process is spawned for them
