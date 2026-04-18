# form-script — goszakup.gov.kz dashboard

## Agent Rules (MANDATORY)

### 1. Playwright MCP Access Required

Before starting any scraper or script work, verify that Playwright MCP tools are available (`mcp__playwright__*`).

**If Playwright MCP is not available: STOP immediately and notify the user:**

> "Playwright MCP is not available in this session. Please start Claude with Playwright MCP enabled before continuing."

Do not attempt to guess selectors or site structure without live browser access.

### 2. Always Test Scripts and Verify Results

Every script change or new script must be tested end-to-end before the task is considered done:

- Use Playwright MCP to open the target site and verify selectors are live and correct.
- Run the actual script (via `node index.js`, `npm run dev`, or the relevant command) and capture real output.
- Confirm the output matches expected behavior — records found, pages scraped, data written.
- If a test fails, fix the issue and re-test. Never report success without actual verified output.

### 3. No Half-Finished Work

Every completed task must be fully functional and ready to use or ready for review:

- All code changes must be wired up end-to-end (not just stubs or TODOs).
- The dev server must start cleanly with no errors after the change.
- Any UI change must be visible and working in the browser.
- Any scraper change must produce real data from the live site.
- Do not leave the codebase in a broken or partially-implemented state.

---

## Project Purpose

Local fullstack admin tool that scrapes the Kazakhstan government procurement
portal (goszakup.gov.kz) for announcements related to educational institutions
(schools, kindergartens, gymnasiums, lyceums), stores them in Postgres, and
exposes a React dashboard for review, scheduling, and per-notice actions.

## Quick Start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install deps (monorepo: root + server + client)
npm install
cp .env.example .env

# 3. Apply migrations and seed project
npm run --workspace server migrate        # MikroORM migration:up
npm run --workspace server db:seed

# 4. (optional) Import existing data/*.json into Postgres
npm run --workspace server db:migrate-json

# 5. Run dev servers (Vite on :3000, Express on :3001)
npm run dev
```

Open http://localhost:3000.

Legacy direct-script mode still works:

```bash
node index.js         # run step1 then step2, writes data/*.json
node index.js --step1
node index.js --step2
node index.js --reset
```

## Architecture

```
form-script/
├── package.json              — root workspaces: server, client + legacy scraper scripts
├── docker-compose.yml        — Postgres 16 service
├── .env.example              — DATABASE_URL, PORT, NODE_ENV
│
├── step1-collect-ids.js      — legacy scraper (still used; spawned by server as child process)
├── step2-collect-details.js  — legacy scraper
├── index.js / config.js / lib/ — legacy scraper entrypoint + helpers
├── data/                     — JSON outputs + Playwright browser profile
│
├── server/                   — Express + MikroORM + node-cron (TypeScript)
│   ├── src/
│   │   ├── index.ts          — Express bootstrap + RequestContext middleware + cron init + static SPA in prod
│   │   ├── mikro-orm.config.ts — shared runtime + CLI config
│   │   ├── migrations/       — MikroORM TS migrations (baseline + subsequent)
│   │   ├── db/
│   │   │   ├── enums.ts      — NoticeStatus, ScriptRunStatus
│   │   │   ├── entities/     — Project, Notice, ScriptRun (decorator entities)
│   │   │   ├── client.ts     — MikroORM.init() bootstrap (initOrm/getOrm/getEm)
│   │   │   └── seed.ts       — seeds project 1 "goszakup"
│   │   ├── routes/
│   │   │   ├── projects.ts   — list, detail, PATCH cron
│   │   │   ├── notices.ts    — list, reject, collect single, bulk step2
│   │   │   ├── runs.ts       — list script runs, poll one run, trigger step1
│   │   │   └── auth.ts       — Playwright headed browser + auth-status
│   │   ├── runner/
│   │   │   ├── runner.ts     — spawns node child, captures logs, writes script_runs
│   │   │   ├── sync.ts       — reads data/*.json → upserts notices
│   │   │   └── runs.ts       — runStep1, runStep2ForNotice, runStep2Bulk
│   │   └── cron/scheduler.ts — node-cron, reschedulable per project
│   └── scripts/migrate-json-to-db.ts — one-shot importer
│
└── client/                   — Vite + React + TS + TanStack Query + shadcn/ui
    ├── vite.config.ts        — proxies /api → localhost:3001
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx          — router + QueryClientProvider
        ├── AppLayout.tsx     — sidebar with project list
        ├── index.css         — tailwind + shadcn tokens
        ├── lib/
        │   ├── api.ts        — axios client + typed endpoints
        │   └── utils.ts      — cn(), formatDateTime()
        ├── pages/
        │   ├── ProjectListPage.tsx
        │   └── ProjectDashboardPage.tsx
        └── components/
            ├── ui/           — shadcn primitives (button, card, badge, input, switch, dialog)
            ├── CronConfig.tsx
            ├── AuthSection.tsx
            ├── SearchKeywordsConfig.tsx
            ├── ScriptDocs.tsx       — run history table with load-more + screenshot modal
            ├── NoticeTable.tsx
            └── NoticeDetail.tsx
```

## API Routes

| Method | Path                                          | Purpose                                                    |
| ------ | --------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/projects`                               | list projects                                              |
| GET    | `/api/projects/:id`                           | project detail + last run                                  |
| PATCH  | `/api/projects/:id/cron`                      | update `cron_expression` / `cron_enabled`, reschedules job |
| PATCH  | `/api/projects/:id/keywords`                  | replace `search_keywords` array                            |
| GET    | `/api/projects/:id/notices`                   | paginated notices (filter by status)                       |
| PATCH  | `/api/projects/:id/notices/:noticeId/reject`  | mark notice rejected                                       |
| POST   | `/api/projects/:id/notices/:noticeId/collect` | run step2 for a single notice                              |
| POST   | `/api/projects/:id/run/step1`                 | run step1 + sync                                           |
| POST   | `/api/projects/:id/run/step2/bulk`            | run step2 for all `new` notices                            |
| GET    | `/api/projects/:id/script-runs`               | paginated runs `{ runs, total }` (params: limit, offset)   |
| GET    | `/api/projects/:id/script-runs/:runId`        | poll one run status + log                                  |
| POST   | `/api/projects/:id/authorize`                 | spawn headed Playwright for manual login                   |
| DELETE | `/api/projects/:id/authorize`                 | kill auth browser                                          |
| GET    | `/api/projects/:id/auth-status`               | `{ authorized, inProgress, checkedAt }`                    |

## Data Model

- **projects**: `id, name, description, target_url, cron_expression, cron_enabled, search_keywords (jsonb default []), created_at`
- **notices**: `id, project_id, notice_id, organizer, title, search_keyword (text nullable), status (new|details_collected|rejected|error), details (jsonb), collected_at, updated_at` — unique `(project_id, notice_id)`
- **script_runs**: `id, project_id, notice_id?, script_name, status (running|success|error), log, screenshot_path (text nullable), started_at, finished_at`

Step 1 skips rejected notices on re-run. Step 2 skips `rejected` and `details_collected`.

## Site Documentation

See [SITE_DOCS.md](./SITE_DOCS.md) for goszakup.gov.kz structure notes.

## For AI Agent / Developer

- **Single source of truth for tuneable scraper params**: `config.js` (legacy) — still drives the child-process scrapers.
- **Server is TypeScript with ESM + MikroORM (PostgreSQL driver)**. Decorator entities live under `server/src/db/entities/`. Each HTTP request is wrapped in `RequestContext.create(orm.em, ...)` so route handlers read `req.em` — a forked EntityManager with its own identity map. Runner modules and cron ticks call `getOrm().em.fork()` explicitly. Run via `tsx watch` in dev, `tsc` build for prod.
- **Client proxies `/api/*` to `localhost:3001`** in dev; in production (`NODE_ENV=production`) the server serves `client/dist`.
- **Cron jobs live in the Express process**. Restart the server to re-register them; edits via UI are applied live.
- **Headed auth**: `POST /api/projects/:id/authorize` opens a real browser on the same machine as the server. Close the window to finish.
- **If site HTML structure changes**, update selectors in `step1-collect-ids.js` / `step2-collect-details.js` and verify via `docker compose up`, `npm run dev`, manual Step 1 run.
- **The JSON-file → Postgres sync** is a deliberate bridge: scripts still write `data/*.json`, server reads them post-run and upserts. Long-term plan is to refactor scripts to write directly.
- **step1-collect-ids.js** now requires `--keyword <text>` arg; also supports `--screenshot-path <path>` (screenshot-only mode). The runner loops over `project.searchKeywords`, running screenshot phase then collection phase per keyword, all writing to a single `script_runs` row.
- **Screenshots** are saved to `data/screenshots/<runId>-<slug>.png` and served via Express static at `/data/screenshots/`. The `screenshot_path` column on `script_runs` stores the relative path.
- **Pre-commit sanity**: keep `SITE_DOCS.md` current, never commit `.env`, never commit `data/browser-profile/`, never commit `data/screenshots/*.png`.

---

To run the first time:

- docker compose up -d
- npm install
- cp .env.example .env
- npm run --workspace server migrate
- npm run --workspace server db:seed
- npm run --workspace server db:migrate-json # optional: import existing data/\*.json
- npm run dev
