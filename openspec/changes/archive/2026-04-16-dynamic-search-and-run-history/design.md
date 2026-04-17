## Context

The goszakup project currently runs a step-1 scraper that opens a hardcoded URL (`https://goszakup.gov.kz/ru/search/announce?filter...`), collects announcement IDs, and syncs them to Postgres. The hardcoded URL makes it impossible to change search terms without editing source code. The "Название" field is always empty because the scraper reads the wrong DOM cell. Run history is rendered with a hard UI limit of 2 rows. There is no way to verify that search parameters were applied correctly before a real run.

## Goals / Non-Goals

**Goals:**
- Make the search keyword(s) configurable per project via the admin UI.
- Run step-1 once per keyword, sequentially, collecting all results into the same Notices table with a `search_keyword` column.
- Fix the "Название" extraction bug.
- Capture a screenshot of the search results page before every real step-1 run so admins can verify params.
- Expose screenshot via the API and display it in the run history UI.
- Show full run history (paginated) instead of the last 2 rows.

**Non-Goals:**
- Parallel per-keyword execution (sequential is intentional to avoid rate-limiting).
- Supporting multiple projects with different scrapers — changes are scoped to the goszakup project.
- Automated comparison of screenshots across runs.

## Decisions

### D1 — Store keywords as JSONB on `projects`

**Decision:** Add a `search_keywords jsonb` column to the `projects` table (default `[]`).

**Rationale:** Keywords are ordered, project-scoped, and few in number (typically < 20). A child table adds join complexity for no benefit at this scale. JSONB is already used for `details` on `Notice`. A single PATCH to `/api/projects/:id/keywords` replaces the whole array atomically.

**Alternative considered:** Separate `search_keywords` table with FK to `projects`. Rejected — over-engineered for a local admin tool.

### D2 — Pass keyword as CLI argument to step-1 child process

**Decision:** The runner calls `node step1-collect-ids.js --keyword "школа"`. The script reads `process.argv` for `--keyword`.

**Rationale:** The script is already invoked as a child process via `runner.ts`. Adding a CLI arg is the minimal-change approach and keeps the script self-contained without introducing IPC.

**Alternative considered:** Write keyword to a temp file read by the script. Rejected — unnecessary indirection.

### D3 — Sequential per-keyword run inside a single `script_runs` row

**Decision:** One "step1" run in the DB covers all keywords. The runner loops over keywords, spawning the child process for each, appending log lines with a `[keyword: X]` prefix. The single `ScriptRun` row captures the aggregate status.

**Rationale:** Keeps the run history simple. Admins see one row per step-1 trigger, not N rows per keyword. The log shows per-keyword progress.

**Alternative considered:** One `script_runs` row per keyword. Rejected — multiplies history rows confusingly and complicates status aggregation.

### D4 — Screenshots saved to `data/screenshots/` as PNG files

**Decision:** The runner saves screenshots to `data/screenshots/<runId>-<keyword-slug>.png`. The `screenshot_path` column on `script_runs` stores the relative path. The server serves `data/screenshots/` as a static directory under `/data/`.

**Rationale:** Avoids storing binary blobs in Postgres. `data/` is already the working directory for scraper output. Serving it as static files is trivial in Express.

**Alternative considered:** Store base64 in the DB `log` field. Rejected — bloats the log column and makes retrieval awkward.

### D5 — Screenshot taken by a dedicated "dry-run" phase inside `step1-collect-ids.js`

**Decision:** When `--screenshot-path <path>` arg is provided, the script navigates to the search page, fills params, clicks search, waits for results, takes a screenshot, then exits (skipping collection). The runner calls this phase first, updates `screenshot_path` on the run row, then proceeds with real per-keyword collection.

**Rationale:** Reuses the same browser automation code for both screenshot and real run. No separate script needed.

### D6 — Full run history with server-side pagination

**Decision:** `GET /api/projects/:id/script-runs?limit=50&offset=0` — default limit 50, max 200. The UI fetches the first page on mount and supports a "Load more" button.

**Rationale:** The API already supports `limit`. Removing the UI 2-row cap and exposing offset is the minimal change. Infinite scroll is not needed for an admin tool.

### D7 — `search_keyword` stored on each `Notice` row

**Decision:** Add `search_keyword text nullable` to `notices`. The sync module (`runner/sync.ts`) accepts the keyword and sets it on upsert.

**Rationale:** Allows filtering notices by keyword in the future. Makes it clear which search produced a result.

## Risks / Trade-offs

- **Sequential keyword execution can be slow** for many keywords (each makes a full browser page load + search). Mitigation: keep keyword lists short; UI shows a running log so the admin sees progress.
- **Screenshot directory grows unbounded**. Mitigation: not addressed in this change (add a cleanup cron in a future iteration).
- **Hardcoded Playwright selectors for goszakup search form** will break if the site restructures. Mitigation: document selectors in `SITE_DOCS.md`; the screenshot-verify feature makes breakage immediately visible.
- **`search_keywords` JSONB migration** — existing projects have no keywords. Mitigation: default to `[]`; the runner skips step-1 if no keywords are configured and shows a clear message.

## Migration Plan

1. Add MikroORM migration: alter `projects` add `search_keywords jsonb default '[]'`; alter `notices` add `search_keyword text`; alter `script_runs` add `screenshot_path text`.
2. Seed update: the existing project-1 seed sets `search_keywords: []` (no-op, default).
3. Deploy: `npm run --workspace server migrate` then restart server.
4. Rollback: reverse migration drops the three columns (no data loss on `notices`/`script_runs` because they are nullable).

## Open Questions

- Should existing notices (imported from JSON) have `search_keyword` backfilled, or left null? → Left null; historical data predates this feature.
- Should the screenshot be shown inline in the run history row or in a modal? → Modal (clicking a camera icon opens the image full-size).
