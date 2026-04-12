## Why

The existing Node.js scripts scrape goszakup.gov.kz and write results to local JSON files, but offer no UI, no persistence, no scheduling, and no multi-project support. Converting them into a local web application with a Postgres-backed dashboard gives the admin visibility, control, and repeatability without touching the terminal.

## What Changes

- Introduce a **Postgres database** that replaces the current `data/*.json` flat-file storage.
- Introduce a **REST API backend** (Express/Node) that:
  - Exposes endpoints for projects, notices, and script execution.
  - Runs Playwright scripts on demand and on a configurable cron schedule.
  - Persists script output and notice status directly to Postgres.
- Introduce a **React frontend dashboard** with:
  - Multi-project navigation ("Project 1 – goszakup", future projects via tabs/sidebar).
  - Per-project views: cron configuration, authorization trigger, notice table, script documentation.
- Adapt the existing `step1-collect-ids.js` and `step2-collect-details.js` scripts to write to Postgres instead of JSON files (or wrap them with a DB-sync layer).
- The current `data/` flat-file approach is **deprecated** for production but may remain as a migration aid.

## Capabilities

### New Capabilities

- `project-management`: Multi-project container — defines a project entity, stores project metadata, exposes project list/detail endpoints.
- `notice-collection`: Step-1 scraping — finds relevant procurement notices and stores them in Postgres; marks already-rejected notices so they are not re-inserted.
- `notice-details`: Step-2 scraping — collects full details for a single notice or all unprocessed notices; stores results in Postgres.
- `notice-dashboard`: Admin UI table showing all notices with status badges, "Не подходит" action, "Собрать информацию" per-row and bulk action.
- `cron-scheduler`: Configurable cron schedule per project — admin can view and edit the schedule; BE fires step-1 automatically.
- `browser-auth`: Admin-triggered Playwright browser session to authenticate on the target website; session cookie persisted in the browser profile.
- `script-docs`: Per-project script/step documentation panel — displays script name, description, and status information pulled from config.

### Modified Capabilities

<!-- none — no existing openspec specs exist for this project -->

## Impact

- **New dependencies**: `express`, `pg` (or `drizzle-orm`/`prisma`), `node-cron`, `react`, `vite` (or similar bundler).
- **Existing files**: `step1-collect-ids.js`, `step2-collect-details.js`, `config.js`, `lib/files.js` — modified or wrapped to write to DB.
- **Data migration**: `data/matched_ids.json`, `data/results.json` can be imported on first run; `data/progress.json` becomes a DB column.
- **Infrastructure**: Requires a local Postgres instance (Docker Compose recommended).
- **No external APIs changed** — all scraping targets remain goszakup.gov.kz.
