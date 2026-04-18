## ADDED Requirements

### Requirement: Bulk Step-2 is invoked automatically after Step-1
The system SHALL accept an automatic caller (the Step-1 runner) as a valid trigger for bulk Step-2, in addition to the existing manual HTTP trigger. The automatic invocation MUST reuse `runStep2Bulk(projectId)` so that skip rules, per-notice `script_runs` creation, and managed-entity persistence are identical to a manual bulk click.

#### Scenario: Step-2 bulk invoked from Step-1 runner
- **WHEN** `runner/runs.ts::runStep1` finishes its keyword loop and calls `runStep2Bulk(projectId)`
- **THEN** the same code path that handles `POST /api/projects/:id/run/step2/bulk` executes, producing one `script_runs` row per eligible notice and flushing details as `details_collected`

#### Scenario: Skip rules apply identically under auto-invocation
- **WHEN** the auto-chained bulk encounters a notice with `status` in (`'rejected'`, `'details_collected'`)
- **THEN** the notice is skipped with no `script_runs` row created — matching the existing skip behavior

#### Scenario: Manual bulk trigger remains available
- **WHEN** admin clicks "Собрать информацию для всех" after the auto-chain has already run
- **THEN** the existing `POST /api/projects/:id/run/step2/bulk` endpoint processes any notices still in `status = 'new'` (for example, notices that errored during the auto-chain) and creates fresh `script_runs` rows
