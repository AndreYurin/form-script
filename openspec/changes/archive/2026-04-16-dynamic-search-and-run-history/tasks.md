## 1. Database Schema & Migration

- [x] 1.1 Add `search_keywords jsonb default '[]'` column to `projects` entity (`server/src/db/entities/project.ts`)
- [x] 1.2 Add `search_keyword text nullable` column to `notices` entity (`server/src/db/entities/notice.ts`)
- [x] 1.3 Add `screenshot_path text nullable` column to `script_runs` entity (`server/src/db/entities/script-run.ts`)
- [x] 1.4 Generate new MikroORM migration for the three schema changes
- [x] 1.5 Verify migration runs cleanly: `npm run --workspace server migrate`
- [x] 1.6 Create `data/screenshots/` directory and ensure it is gitignored

## 2. Step-1 Script: Dynamic Search

- [x] 2.1 Add `--keyword <text>` CLI argument parsing to `step1-collect-ids.js` (exit with error if missing)
- [x] 2.2 Replace hardcoded search URL navigation with: navigate to base search page, fill "Наименование объявления" input with keyword, select three "Статус" checkboxes, click "Найти", wait for result rows
- [x] 2.3 Fix "Название" extraction: read title from the organizer cell by taking text before the "Организатор:" label within that cell
- [x] 2.4 Add `--screenshot-path <path>` argument: when provided, take screenshot after search results load and exit without collecting IDs
- [x] 2.5 Verify `step1-collect-ids.js` still handles multi-page pagination correctly after search

## 3. Server: Keywords Config API

- [x] 3.1 Add `PATCH /api/projects/:id/keywords` endpoint that validates and saves `searchKeywords` array to `project.searchKeywords`
- [x] 3.2 Include `searchKeywords` in `GET /api/projects/:id` response serialization
- [x] 3.3 Add guard in `runStep1` runner: if `search_keywords` is empty, throw a descriptive error (no run started)

## 4. Server: Runner — Sequential Per-Keyword Execution & Screenshot

- [x] 4.1 Update `runner/runs.ts` `runStep1`: load project's `search_keywords`; for each keyword: (a) run screenshot phase (`--screenshot-path`), (b) update `script_runs.screenshot_path`, (c) run real collection with `--keyword`
- [x] 4.2 Append `[keyword: X]`-prefixed log lines to the single `ScriptRun` row throughout the loop
- [x] 4.3 Pass `searchKeyword` through to `sync.ts` so each upserted notice gets `search_keyword` set

## 5. Server: Sync Module Update

- [x] 5.1 Add optional `searchKeyword` parameter to the `syncResults` function in `runner/sync.ts`
- [x] 5.2 Set `notice.searchKeyword = searchKeyword` on every insert/update in the sync (leave null when not provided)

## 6. Server: Run History API Update

- [x] 6.1 Add `offset` query parameter to `GET /api/projects/:id/script-runs`; change response shape to `{ runs: [...], total: number }`
- [x] 6.2 Include `screenshotPath` in `serializeScriptRun` output
- [x] 6.3 Serve `data/screenshots/` as Express static files under `/data/screenshots/`

## 7. Server: Notices API Update

- [x] 7.1 Include `searchKeyword` field in the notices list response serialization

## 8. Client: Search Keywords Config UI

- [x] 8.1 Create `SearchKeywordsConfig` component: list of keyword rows, "Add" button, per-row delete button, "Save" button
- [x] 8.2 Wire "Save" to `PATCH /api/projects/:id/keywords`; invalidate project query on success
- [x] 8.3 Add `searchKeywords` to the project API type and `queries.getProject` response
- [x] 8.4 Mount `SearchKeywordsConfig` on `ProjectDashboardPage` alongside `CronConfig`
- [x] 8.5 Disable "Запустить Step 1" button and show tooltip when `searchKeywords` is empty

## 9. Client: Run History UI Update

- [x] 9.1 Update `ScriptDocs` run history section (or create new `RunHistory` component) to use `{ runs, total }` response shape with `offset` pagination
- [x] 9.2 Show all columns per run row: ID, script name, status badge, start time, duration, camera icon (when `screenshotPath` is set)
- [x] 9.3 Add "Load more" button that fetches next page and appends rows; hide when all runs are loaded
- [x] 9.4 Implement screenshot modal: clicking camera icon opens a dialog with `<img>` pointing to `/data/screenshots/<file>`

## 10. Client: Notices Table Update

- [x] 10.1 Add "Ключевое слово" column to `NoticeTable` showing `searchKeyword` or "—" when null

## 11. Docs & Cleanup

- [x] 11.1 Update `ScriptDocs` content to describe `--keyword` arg, sequential execution, screenshot phase, and keyword configuration
- [x] 11.2 Update `SITE_DOCS.md` with current selectors used for the search form (Наименование, Статус checkboxes, Найти button)
- [x] 11.3 Update `CLAUDE.md` architecture section to reflect new columns and keyword API endpoint
- [ ] 11.4 Manual smoke test: configure 2 keywords → trigger Step 1 → verify screenshot saved, notices have correct keywords, run history shows full list with camera icon
