# Full Run History Specification

## Purpose

Paginated run history table in the project dashboard that shows all script runs with load-more support, status badges, durations, and screenshot indicators.

## Requirements

### Requirement: API supports offset-based pagination for run history
The `GET /api/projects/:id/script-runs` endpoint SHALL accept `limit` (default 50, max 200) and `offset` (default 0) query parameters. The response SHALL include `{ runs: [...], total: number }` so the UI knows whether more pages exist.

#### Scenario: First page request
- **WHEN** `GET /api/projects/1/script-runs?limit=50&offset=0` is called
- **THEN** the response contains up to 50 runs ordered by `startedAt` descending and a `total` field with the count of all runs for that project

#### Scenario: Subsequent page request
- **WHEN** `GET /api/projects/1/script-runs?limit=50&offset=50` is called
- **THEN** the response contains runs 51–100 (if they exist) with the same `total`

### Requirement: Run history UI shows all runs with load-more
The run history panel SHALL display runs in a scrollable table. On mount it loads the first page (50 runs). A "Load more" button SHALL appear at the bottom if `total > runs.length`. Clicking it fetches the next page and appends rows.

#### Scenario: Fewer than 50 runs
- **WHEN** the project has 10 runs
- **THEN** all 10 are shown and no "Load more" button appears

#### Scenario: More than 50 runs
- **WHEN** the project has 120 runs
- **THEN** 50 runs are shown initially and a "Load more" button is visible; clicking it adds the next 50; clicking again adds the remaining 20; the button then disappears

### Requirement: Run history row includes screenshot indicator and keyword summary
Each run history row SHALL display: run ID, script name, status badge, start time, duration, and — when available — a camera icon for the screenshot. The log preview (first line) SHALL also be shown as a tooltip or expandable row.

#### Scenario: Run row with screenshot
- **WHEN** a run has `screenshotPath` set
- **THEN** the camera icon is rendered in the row per the run-screenshot spec

#### Scenario: Run row without screenshot
- **WHEN** a run has no `screenshotPath`
- **THEN** the row renders without the camera icon
