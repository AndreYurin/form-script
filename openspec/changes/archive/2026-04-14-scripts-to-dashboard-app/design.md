## Context

The project currently consists of standalone Node.js scripts (`step1-collect-ids.js`, `step2-collect-details.js`) that write output to local JSON files under `data/`. There is no UI, no scheduling, no authentication management UI, and no multi-project support. The admin must run commands manually in the terminal and inspect raw JSON to understand results.

The goal is to wrap these scripts in a proper full-stack local application:
- **Backend**: Express API + node-cron, runs on localhost.
- **Frontend**: React SPA served by the backend (or Vite dev server in development).
- **Database**: PostgreSQL — stores projects, notices, and script run logs.

The existing Playwright scraping logic must be preserved and should not be rewritten from scratch; instead, the BE layer will invoke the existing scripts as child processes (or import them as modules) and sync their output to Postgres.

## Goals / Non-Goals

**Goals:**
- Single local application (no cloud, no external services).
- Admin dashboard accessible at `http://localhost:3000`.
- Multi-project architecture: Project 1 (goszakup) is the first tenant; future projects can be added without changes to the core platform.
- Postgres replaces flat JSON files for notice storage and progress tracking.
- Cron schedule is configurable per-project via UI; stored in DB.
- Admin can trigger browser-based authorization via the UI (Playwright opens a visible browser window on the local machine).
- Step-1 and Step-2 can be triggered manually per-notice or in bulk from the UI, and run automatically on schedule.
- Notices can be marked "Не подходит" so they are skipped on future runs.
- Script documentation is rendered in the dashboard.

**Non-Goals:**
- Cloud deployment, multi-user auth, or RBAC.
- Generic/universal script runner — each project has its own hardcoded scripts.
- Mobile responsiveness (desktop-only admin tool).
- Real-time log streaming (logs can be polled or shown after run completion).

## Decisions

### 1. Monorepo layout: `server/` + `client/`

**Decision**: Keep everything in the same repo with two top-level directories: `server/` (Express API, scripts) and `client/` (React SPA). A root `package.json` with `workspaces` ties them together.

**Rationale**: Simplest local setup — one `npm install`, one `docker-compose up`. Avoids the complexity of separate repos for a single-admin local tool.

**Alternative considered**: Separate repos or a dedicated monorepo tool (Turborepo) — overkill for a local admin tool.

---

### 2. Existing scripts invoked as child processes

**Decision**: The BE spawns `node step1-collect-ids.js` and `node step2-collect-details.js` as child processes (via `child_process.spawn`). Script output (stdout/stderr) is captured and stored in a `script_runs` table.

**Rationale**: Preserves the existing scripts untouched. The scripts currently write to `data/*.json`; a thin "DB sync" layer in the API reads those files after each run and upserts them into Postgres. This avoids rewriting the Playwright scraping logic.

**Alternative considered**: Refactor scripts to import `pg` directly — cleaner long-term but risks breaking the working scraper.

**Migration path**: Once the DB sync layer is stable, scripts can gradually be refactored to write directly to Postgres.

---

### 3. ORM: Drizzle ORM (with `pg` driver)

**Decision**: Use Drizzle ORM for schema definition and queries.

**Rationale**: Lightweight, TypeScript-friendly, no magic — schema is plain JS/TS objects. Migrations are SQL files that can be reviewed. Easy to swap to raw `pg` if needed.

**Alternative considered**: Prisma — heavier, requires a separate daemon, overkill for a local tool. Raw `pg` — verbose for CRUD operations.

---

### 4. Frontend: React + Vite + TanStack Query

**Decision**: React SPA with Vite as the dev bundler. TanStack Query for server-state (notice lists, script run status). No global state manager.

**Rationale**: Standard, fast, minimal. TanStack Query handles polling (for live run status), caching, and optimistic updates well. No need for Redux/Zustand for this data shape.

**Alternative considered**: Next.js — SSR is unnecessary for a local admin tool; adds deployment complexity. Vue/Svelte — team familiarity with React preferred.

---

### 5. Cron scheduler: `node-cron` in the Express process

**Decision**: Use `node-cron` embedded in the Express server process. Schedule is stored in the `projects` table (`cron_expression` column). On server start the active cron is re-registered from DB.

**Rationale**: No additional process required. For a local tool with a single project the simplicity outweighs the loss of process isolation.

**Alternative considered**: `bull`/`bullmq` with Redis — too heavy for a single local tool.

---

### 6. Docker Compose for Postgres only

**Decision**: Provide a `docker-compose.yml` that runs only Postgres. The Node server and React dev server run natively with `npm run dev`.

**Rationale**: Keeps local development fast (no Docker build for app code). Admin can also install Postgres natively if preferred.

---

### 7. Notice status model

Notices have a `status` field in Postgres:

| Status | Meaning |
|---|---|
| `new` | Collected by Step 1, not yet processed |
| `details_collected` | Step 2 ran successfully |
| `rejected` | Marked "Не подходит" by admin |
| `error` | Step 2 failed |

Step 1 does not re-insert a notice with `rejected` status. Step 2 skips `rejected` and `details_collected` notices unless forced.

## Risks / Trade-offs

**File-sync brittleness**: Syncing from `data/*.json` to Postgres after each script run is a temporary hack. If a script crashes mid-write, data may be partially synced.
→ Mitigation: Use a transaction; store the raw JSON as a fallback column. Plan to remove the file-sync layer in a follow-up.

**Child process isolation**: Spawning scripts as child processes means an unhandled exception in a script does not crash the API server, but also means we have limited visibility into progress.
→ Mitigation: Capture stdout/stderr line by line; parse the logger output (which already uses structured `INFO`/`ERROR` prefixes) to update `script_runs.status`.

**node-cron reliability**: `node-cron` is tied to the Express process; if the server restarts, the cron resumes on next start. For a local always-on tool this is acceptable.
→ Mitigation: Document that the server should be started via `pm2` or similar to keep it running.

**Playwright + visible browser on auth**: The "authorize" feature opens a real browser window on the local machine. This only works if the server is running on the same machine as the display.
→ Mitigation: For the current use case (single local admin) this is the desired behavior. Document it clearly.

## Migration Plan

1. Set up Docker Compose + Postgres; run Drizzle migrations to create tables.
2. Add DB sync layer: after each script run, read `data/matched_ids.json` / `data/results.json` and upsert into Postgres.
3. Deploy Express API and React SPA locally.
4. On first successful run, verify data parity between JSON files and DB.
5. Once stable, the JSON files become optional backups.

**Rollback**: If the application is broken, the original scripts can still be run directly from the terminal (`node index.js`) — they continue to write to `data/*.json` unchanged.

## Open Questions

- Should the Express server also serve the built React SPA in production mode, or always require a separate Vite dev server? (Leaning: serve from Express in "production" local mode, Vite in dev.)
- Should script logs be streamed in real-time via SSE/WebSocket, or is polling every 2s sufficient for the MVP? (Leaning: polling for MVP.)
- Will there be more than one admin user in the near term? (Leaning: single-user, no auth required for now — the app is localhost-only.)
