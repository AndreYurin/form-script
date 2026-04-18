## ADDED Requirements

### Requirement: Run history row renders cancelled status
Each run history row SHALL render a distinct badge when `status === 'cancelled'` so operators can tell cancellation apart from failure at a glance. The badge text SHALL read "Отменён" and the variant SHALL differ visually from the `error` badge.

#### Scenario: Cancelled run appears in history
- **WHEN** a run has `status = 'cancelled'`
- **THEN** its row shows a neutral "Отменён" badge (not the red "Ошибка" error badge)

### Requirement: Run history row exposes a Stop action for running runs
Each run history row whose `status` is `running` SHALL include a "Stop" action button. Clicking the button SHALL call `POST /api/projects/:id/script-runs/:runId/stop`, disable itself during the request, show a toast or inline error on failure, and invalidate the paginated run-history query on success so the row transitions to `cancelled`.

#### Scenario: Stop action on a running row
- **WHEN** a run history row has `status = 'running'`
- **THEN** the Stop button is visible in that row

#### Scenario: Stop action not shown on terminal rows
- **WHEN** a run history row has `status` of `success`, `error`, or `cancelled`
- **THEN** no Stop button is rendered in that row

#### Scenario: Stop action failure surfaces to operator
- **WHEN** the server returns a non-2xx response for the stop request (for example `409 Conflict` because the run already finalized)
- **THEN** the UI surfaces a visible error message and the row refreshes to reflect the current server-side status
