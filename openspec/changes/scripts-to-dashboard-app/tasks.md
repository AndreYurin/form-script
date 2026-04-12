## 1. Repo & Tooling Setup

- [x] 1.1 Add root `package.json` with `workspaces: ["server", "client"]` and scripts: `dev`, `build`, `migrate`
- [x] 1.2 Create `docker-compose.yml` with a Postgres 16 service (port 5432, named volume)
- [x] 1.3 Create `.env.example` with `DATABASE_URL`, `PORT`, `NODE_ENV`
- [x] 1.4 Add `.gitignore` entries for `.env`, `data/browser-profile/`, `node_modules/`

## 2. Database Schema & Migrations

- [x] 2.1 Set up `server/` Node package with `drizzle-orm`, `drizzle-kit`, `pg`, `dotenv`
- [x] 2.2 Define Drizzle schema: `projects` table (id, name, description, target_url, cron_expression, cron_enabled, created_at)
- [x] 2.3 Define Drizzle schema: `notices` table (id, project_id, notice_id, organizer, title, status enum[new/details_collected/rejected/error], details JSONB, collected_at, updated_at)
- [x] 2.4 Define Drizzle schema: `script_runs` table (id, project_id, notice_id nullable, script_name, status enum[running/success/error], log TEXT, started_at, finished_at)
- [x] 2.5 Generate and apply initial migration; seed Project 1 row ("goszakup – Госзакупки")

## 3. Express API – Core

- [x] 3.1 Scaffold Express server in `server/src/index.ts` (or `.js`) with CORS, JSON body parser, static SPA serving
- [x] 3.2 Implement `GET /api/projects` → list all projects
- [x] 3.3 Implement `GET /api/projects/:id` → project detail + last cron run info
- [x] 3.4 Implement `PATCH /api/projects/:id/cron` → update cron_expression and cron_enabled; reschedule node-cron job
- [x] 3.5 Implement `GET /api/projects/:id/notices` → paginated notice list (filter by status)
- [x] 3.6 Implement `PATCH /api/projects/:id/notices/:noticeId/reject` → set status = rejected
- [x] 3.7 Implement `GET /api/projects/:id/script-runs` → last N runs per script_name

## 4. Script Execution Layer

- [x] 4.1 Create `server/src/runner.js` utility: spawns a Node script as a child process, streams stdout/stderr, inserts a `script_runs` row, returns promise resolving when process exits
- [x] 4.2 Create `server/src/sync.js`: after step-1 run reads `data/matched_ids.json` and upserts new notice IDs into `notices` (skips `rejected` rows)
- [x] 4.3 Create `server/src/sync.js` extension: after step-2 run reads `data/results.json` and upserts detail fields + status into the matching `notices` row
- [x] 4.4 Implement `POST /api/projects/:id/run/step1` → triggers step-1 via runner, then calls sync, returns `script_run.id`
- [x] 4.5 Implement `POST /api/projects/:id/notices/:noticeId/collect` → triggers step-2 for one notice; skip if rejected/details_collected
- [x] 4.6 Implement `POST /api/projects/:id/run/step2/bulk` → triggers step-2 for all `new` notices sequentially; returns list of script_run IDs
- [x] 4.7 Implement `GET /api/projects/:id/script-runs/:runId` → return run status + log (for polling)

## 5. Cron Scheduler

- [x] 5.1 Add `node-cron` dependency to server
- [x] 5.2 On server startup, read `projects` table and register a `node-cron` job for each project with `cron_enabled = true`
- [x] 5.3 Each cron job calls the same step-1 runner + sync as the manual endpoint
- [x] 5.4 When `PATCH /api/projects/:id/cron` is called, destroy the old cron job and register a new one (or pause if `cron_enabled = false`)

## 6. Browser Auth Endpoint

- [x] 6.1 Implement `POST /api/projects/:id/authorize` → spawns Playwright in headed mode, navigates to project auth URL, keeps process alive until admin closes browser or sends `DELETE /api/projects/:id/authorize`
- [x] 6.2 Implement `DELETE /api/projects/:id/authorize` → kills the authorization browser process
- [x] 6.3 Implement `GET /api/projects/:id/auth-status` → checks for a valid session cookie in the browser profile directory; returns `{ authorized: bool, checkedAt }`

## 7. React Client – Setup

- [x] 7.1 Scaffold Vite + React + TypeScript project in `client/`
- [x] 7.2 Add `@tanstack/react-query`, `axios` (or `fetch`), a lightweight component library (e.g., shadcn/ui or plain CSS modules)
- [x] 7.3 Configure Vite proxy to forward `/api/*` to `localhost:3001` in dev mode
- [x] 7.4 Set up React Router with routes: `/` (project list), `/projects/:id` (project dashboard)

## 8. React Client – Project List & Navigation

- [x] 8.1 Build `ProjectList` sidebar/tab component that fetches `GET /api/projects` and renders project entries
- [x] 8.2 Highlight the active project; navigate to `/projects/:id` on click

## 9. React Client – Project Dashboard

- [x] 9.1 Build `ProjectDashboard` page layout with sections: Header (name, auth status), Cron Config, Script Docs, Notice Table
- [x] 9.2 Build `CronConfig` section: display current expression + human-readable label, editable field, save/enable-disable toggle; calls `PATCH /api/projects/:id/cron`
- [x] 9.3 Build `AuthSection` component: "Авторизоваться" button, auth status badge, in-progress indicator; calls `POST /api/projects/:id/authorize` and polls `GET /api/projects/:id/auth-status`
- [x] 9.4 Build `ScriptDocs` section: hardcoded per-project script entries (Step 1, Step 2) with name, description, last run badge; fetches last run from `GET /api/projects/:id/script-runs`
- [x] 9.5 Build `NoticeTable` component: paginated table with columns (ID, organizer, title, status, collected_at, actions); polls `GET /api/projects/:id/notices` every 5 s
- [x] 9.6 Implement "Не подходит" button per row: calls `PATCH .../notices/:noticeId/reject`, optimistic status update
- [x] 9.7 Implement "Собрать информацию" button per row (disabled if rejected/details_collected): calls `POST .../notices/:noticeId/collect`, shows loading state, polls run status
- [x] 9.8 Implement "Собрать информацию для всех" bulk button (disabled if no `new` notices): calls `POST .../run/step2/bulk`, shows progress
- [x] 9.9 Implement "Запустить Step 1" button: calls `POST .../run/step1`, shows loading/log snippet

## 10. Notice Detail View

- [x] 10.1 Build `NoticeDetail` expandable row or modal: renders all fields from `notices.details` JSONB as a key-value list
- [x] 10.2 Ensure long text fields are readable (scroll container, not truncation)

## 11. Integration & Data Migration

- [x] 11.1 Write a one-time migration script `server/scripts/migrate-json-to-db.js` that reads `data/matched_ids.json` and `data/results.json` and upserts into Postgres
- [ ] 11.2 Test full flow: start docker-compose, run migrations, seed project, import existing data, run Step 1 from UI, verify notices appear, run Step 2 on one notice, verify details appear  _(manual verification — requires `npm install`, `docker compose up`, and running browser session)_

## 12. Documentation

- [x] 12.1 Update `CLAUDE.md` with new architecture overview, setup instructions (Docker, env vars, `npm run dev`), and API route summary
- [x] 12.2 Update `SITE_DOCS.md` if any selector changes were made during integration  _(N/A — no selector changes; legacy scrapers left untouched)_
