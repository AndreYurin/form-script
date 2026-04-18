## ADDED Requirements

### Requirement: Step-2 runs headless by default
The `step2-collect-details.js` child process SHALL launch Chromium in headless mode by default for both per-notice and bulk invocations. The runner MUST NOT pass any flag that re-enables headed mode unless explicitly requested for debugging.

#### Scenario: Per-notice Step-2 run is headless
- **WHEN** admin clicks "Собрать информацию" on a notice
- **THEN** `step2-collect-details.js` runs with a headless Chromium and updates the notice's `details` as before, with no visible window

#### Scenario: Bulk Step-2 run is headless
- **WHEN** `runStep2Bulk` iterates notices (manually or via the Step-1 auto-chain)
- **THEN** every spawned Step-2 child runs headless

### Requirement: Step-2 is cancellable mid-flight
The Step-2 runner SHALL honour an in-process cancellation flag. When a bulk Step-2 loop is cancelled (directly, or because its owning Step-1 row was cancelled), the runner MUST terminate the currently running per-notice child, stop spawning further children, and record the cancellation in the relevant `script_runs` rows.

#### Scenario: Admin cancels a standalone bulk Step-2
- **WHEN** admin cancels a `runStep2Bulk` invocation that was triggered manually via `POST /api/projects/:id/run/step2/bulk`
- **THEN** the current per-notice child is terminated, no further per-notice children are spawned, the terminated child's `script_runs` row ends with `status = 'cancelled'`, and notices already finalized earlier in the loop retain their existing statuses

#### Scenario: Bulk Step-2 cancelled as part of Step-1 cancellation
- **WHEN** admin cancels a Step-1 row whose auto-chained bulk Step-2 phase is currently running
- **THEN** the active per-notice Step-2 child is terminated, its `script_runs` row is marked `cancelled`, no further per-notice children are spawned, and the Step-1 row is also finalized as `cancelled`
