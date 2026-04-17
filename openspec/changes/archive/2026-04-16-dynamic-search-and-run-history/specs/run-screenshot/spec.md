## ADDED Requirements

### Requirement: Runner captures search-results screenshot before real collection
Before executing the actual ID-collection phase for any step-1 run, the runner SHALL invoke the script in screenshot-only mode (`--screenshot-path <path>`). The script SHALL navigate to the search page, apply all search params, wait for results, capture a PNG screenshot, save it to the given path, and exit. The runner SHALL store the relative path in `script_runs.screenshot_path`.

#### Scenario: Screenshot is saved successfully
- **WHEN** a step-1 run is triggered with at least one keyword
- **THEN** a PNG file is written to `data/screenshots/<runId>-<keyword-slug>.png` before collection begins, and `script_runs.screenshot_path` is set to that relative path

#### Scenario: Screenshot fails (e.g. site unreachable)
- **WHEN** the screenshot phase fails with an error
- **THEN** the run proceeds to the collection phase anyway, `screenshot_path` remains null, and the failure is appended to the run log

### Requirement: Screenshots are served as static files
The Express server SHALL serve `data/screenshots/` under `/data/screenshots/` so that screenshot URLs are directly accessible in the browser.

#### Scenario: Screenshot URL is accessible
- **WHEN** `screenshot_path` is `"data/screenshots/42-shkola.png"`
- **THEN** `GET /data/screenshots/42-shkola.png` returns the PNG file with status 200

### Requirement: Run history UI shows screenshot viewer
For any run row that has a `screenshotPath` value, the run history table SHALL display a camera icon button. Clicking it SHALL open a modal or lightbox showing the full screenshot image.

#### Scenario: Run has screenshot — camera icon shown
- **WHEN** a run row has a non-null `screenshotPath`
- **THEN** a camera icon appears in that row

#### Scenario: Admin clicks camera icon
- **WHEN** the admin clicks the camera icon on a run row
- **THEN** a modal opens displaying the screenshot image at its full resolution

#### Scenario: Run has no screenshot — no icon shown
- **WHEN** a run row has `screenshotPath: null`
- **THEN** no camera icon is rendered in that row
