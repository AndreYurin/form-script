## ADDED Requirements

### Requirement: Step-2 auto-chain after Step-1 completion
The system SHALL automatically invoke a bulk Step-2 run immediately after the Step-1 keyword loop finalizes, covering every notice in the project whose `status` is `'new'`. Step 2 SHALL run regardless of whether all Step-1 keywords succeeded, so that notices collected by successful keywords are enriched even if a sibling keyword failed. Failures inside the chained Step-2 phase MUST NOT change the Step-1 `ScriptRun` row's terminal `status`; they MUST be appended to the Step-1 `log` so they remain discoverable.

#### Scenario: Manual Step-1 chains into Step-2
- **WHEN** admin triggers `POST /api/projects/:id/run/step1` and the project has keywords `["школа", "лицей"]`
- **THEN** after the keyword loop completes, the runner invokes `runStep2Bulk(projectId)` and produces one `script_runs` row per eligible notice with `scriptName = 'step2'`, in addition to the single Step-1 `script_runs` row

#### Scenario: Scheduled Step-1 chains into Step-2
- **WHEN** the node-cron tick fires and runs Step-1 for the project
- **THEN** the same scheduled invocation proceeds to Step-2 bulk for all `status = 'new'` notices before returning control to the scheduler

#### Scenario: Step-1 partial failure still triggers Step-2
- **WHEN** Step-1 finishes with `overallSuccess = false` because one keyword's collection failed but others produced notices
- **THEN** the runner still invokes `runStep2Bulk(projectId)` and the Step-1 `script_runs` row is finalized with `status = 'error'` without being reopened by the chained Step-2 outcome

#### Scenario: Step-2 auto-chain errors recorded in Step-1 log
- **WHEN** the chained `runStep2Bulk` call throws or individual per-notice Step-2 runs fail
- **THEN** the runner appends a human-readable error line to the Step-1 `ScriptRun.log` and does not rethrow, so the Step-1 caller (HTTP handler or cron) still receives the finalized Step-1 row
