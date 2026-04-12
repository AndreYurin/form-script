# form-script — goszakup.gov.kz dashboard

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
npm run --workspace server db:generate   # first time only
npm run --workspace server migrate
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
├── server/                   — Express + Drizzle + node-cron (TypeScript)
│   ├── drizzle.config.ts
│   ├── drizzle/              — generated SQL migrations
│   ├── src/
│   │   ├── index.ts          — Express bootstrap + cron init + static SPA in prod
│   │   ├── db/
│   │   │   ├── schema.ts     — projects, notices, script_runs tables + enums
│   │   │   ├── client.ts     — pg Pool + drizzle instance
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
            ├── ScriptDocs.tsx
            ├── NoticeTable.tsx
            └── NoticeDetail.tsx
```

## API Routes

| Method | Path                                          | Purpose                                                    |
| ------ | --------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/projects`                               | list projects                                              |
| GET    | `/api/projects/:id`                           | project detail + last run                                  |
| PATCH  | `/api/projects/:id/cron`                      | update `cron_expression` / `cron_enabled`, reschedules job |
| GET    | `/api/projects/:id/notices`                   | paginated notices (filter by status)                       |
| PATCH  | `/api/projects/:id/notices/:noticeId/reject`  | mark notice rejected                                       |
| POST   | `/api/projects/:id/notices/:noticeId/collect` | run step2 for a single notice                              |
| POST   | `/api/projects/:id/run/step1`                 | run step1 + sync                                           |
| POST   | `/api/projects/:id/run/step2/bulk`            | run step2 for all `new` notices                            |
| GET    | `/api/projects/:id/script-runs`               | last N runs                                                |
| GET    | `/api/projects/:id/script-runs/:runId`        | poll one run status + log                                  |
| POST   | `/api/projects/:id/authorize`                 | spawn headed Playwright for manual login                   |
| DELETE | `/api/projects/:id/authorize`                 | kill auth browser                                          |
| GET    | `/api/projects/:id/auth-status`               | `{ authorized, inProgress, checkedAt }`                    |

## Data Model

- **projects**: `id, name, description, target_url, cron_expression, cron_enabled, created_at`
- **notices**: `id, project_id, notice_id, organizer, title, status (new|details_collected|rejected|error), details (jsonb), collected_at, updated_at` — unique `(project_id, notice_id)`
- **script_runs**: `id, project_id, notice_id?, script_name, status (running|success|error), log, started_at, finished_at`

Step 1 skips rejected notices on re-run. Step 2 skips `rejected` and `details_collected`.

## Site Documentation

See [SITE_DOCS.md](./SITE_DOCS.md) for goszakup.gov.kz structure notes.

## For AI Agent / Developer

- **Single source of truth for tuneable scraper params**: `config.js` (legacy) — still drives the child-process scrapers.
- **Server is TypeScript with ESM + drizzle-orm**. Run via `tsx watch` in dev, `tsc` build for prod.
- **Client proxies `/api/*` to `localhost:3001`** in dev; in production (`NODE_ENV=production`) the server serves `client/dist`.
- **Cron jobs live in the Express process**. Restart the server to re-register them; edits via UI are applied live.
- **Headed auth**: `POST /api/projects/:id/authorize` opens a real browser on the same machine as the server. Close the window to finish.
- **If site HTML structure changes**, update selectors in `step1-collect-ids.js` / `step2-collect-details.js` and verify via `docker compose up`, `npm run dev`, manual Step 1 run.
- **The JSON-file → Postgres sync** is a deliberate bridge: scripts still write `data/*.json`, server reads them post-run and upserts. Long-term plan is to refactor scripts to write directly.
- **Pre-commit sanity**: keep `SITE_DOCS.md` current, never commit `.env`, never commit `data/browser-profile/`.

---

To run the first time:

- docker compose up -d
- npm install
- cp .env.example .env
- npm run --workspace server db:generate
- npm run --workspace server migrate
- npm run --workspace server db:seed
- npm run --workspace server db:migrate-json # optional: import existing data/\*.json
- npm run dev
