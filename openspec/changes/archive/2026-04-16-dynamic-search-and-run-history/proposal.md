## Why

The goszakup scraper currently uses a hardcoded URL with fixed search parameters, making it impossible to customize searches without editing source code. Additionally, the run history only retains the last two rows, losing visibility into past runs, and the "Название" field is always empty because the scraper reads the wrong DOM element.

## What Changes

- Replace the hardcoded search URL in step1 with dynamic search: the script receives a search keyword, navigates to the search page, fills in "Наименование объявления", selects three "Статус" values, clicks "Найти", and waits for results before proceeding.
- Add a "Search Keywords" configuration UI on the project page where admins can add/delete multiple search keywords. Step 1 runs sequentially for each keyword, and each collected notice row stores the keyword used.
- Fix "Название" extraction: the script reads the title from the same cell as "Организатор" (the text before "Организатор:"), not from the currently targeted element.
- Add a pre-run screenshot feature: before every real step-1 execution, a test pass opens the page, applies search params, and saves a screenshot. The run history row displays a clickable link/thumbnail to that screenshot.
- Expand run history to show all past runs (paginated or scrollable) instead of only the last two.

## Capabilities

### New Capabilities

- `dynamic-search`: Script accepts a search keyword, navigates to the goszakup search page, fills form fields ("Наименование объявления" + three "Статус" checkboxes), clicks "Найти", and waits for results before collecting.
- `search-keywords-config`: UI panel on the project page to manage an ordered list of search keywords (add row, delete row, save). Keywords are persisted in the `projects` table (or a new child table).
- `search-keyword-tracking`: Each notice row records which search keyword produced it. The notices table and API include a `search_keyword` column.
- `run-screenshot`: Before every real step-1 run, the runner performs a dry-navigation pass and captures a screenshot of the search results page with params applied. The screenshot path is stored on the `script_runs` row and exposed via the API.
- `full-run-history`: The run history panel shows all runs for a project (paginated), not just the latest two.

### Modified Capabilities

- `notice-collection`: The notice-collection flow now accepts a `searchKeyword` parameter; each collected notice stores `search_keyword`. The step-1 loop iterates over all configured keywords sequentially.
- `notice-dashboard`: The notices table gains a "Search Keyword" column.
- `script-docs`: Documentation updated to reflect the new dynamic search and screenshot features.

## Impact

- **`step1-collect-ids.js`**: Major rewrite — remove hardcoded URL, add `searchKeyword` CLI arg, add form-fill + status-checkbox logic, add screenshot-before-run path.
- **`server/src/db/entities/Project.ts`**: Add `search_keywords: string[]` (jsonb) column.
- **`server/src/db/entities/Notice.ts`**: Add `search_keyword: string | null` column.
- **`server/src/db/entities/ScriptRun.ts`**: Add `screenshot_path: string | null` column.
- **`server/src/routes/notices.ts`** / **`projects.ts`**: Expose new fields; add keyword config PATCH endpoint.
- **`server/src/runner/runs.ts`**: Pass keywords into step-1 child process args; run sequentially per keyword.
- **`server/src/routes/runs.ts`**: Remove artificial 2-row limit; add screenshot field in response.
- **`client/src/pages/ProjectDashboardPage.tsx`** + components: Add keyword editor, screenshot viewer, full run history table.
- **New MikroORM migration** required for schema changes.
