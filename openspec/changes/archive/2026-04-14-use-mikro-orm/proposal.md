## Why

The server currently uses drizzle-orm with hand-written SQL migrations and a thin query layer. As the schema grows (projects, notices, script_runs, plus upcoming relations), we need richer entity modeling, a unit-of-work for multi-table writes (e.g., step2 sync), and a first-class migration workflow. MikroORM provides identity map, unit of work, entity relations, and a mature migrator out of the box, which better fits how this app evolves.

## What Changes

- **BREAKING**: Replace drizzle-orm with MikroORM (PostgreSQL driver) as the server's ORM.
- Rewrite `server/src/db/schema.ts` as MikroORM entity classes (`Project`, `Notice`, `ScriptRun`) with decorators and relations.
- Replace `server/drizzle/` SQL migrations with MikroORM migrations under `server/src/migrations/`.
- Replace the drizzle `db` client in `server/src/db/client.ts` with a MikroORM `EntityManager` / `MikroORM` instance, exposed via a request-scoped fork.
- Update all routes (`projects.ts`, `notices.ts`, `runs.ts`, `auth.ts`) and runner modules (`sync.ts`, `runner.ts`, `runs.ts`, `cron/scheduler.ts`) to use the MikroORM EntityManager instead of drizzle query builder.
- Rewrite `server/src/db/seed.ts` and `server/scripts/migrate-json-to-db.ts` against MikroORM.
- Update `package.json` scripts (`db:generate`, `migrate`, `db:seed`) to call MikroORM CLI equivalents.
- Remove `drizzle-orm`, `drizzle-kit` dependencies; add `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@mikro-orm/cli`.

## Capabilities

### New Capabilities

_None._ This change swaps the ORM implementation; no new product capabilities are introduced.

### Modified Capabilities

- `project-management`: Project persistence moves from drizzle tables/queries to MikroORM `Project` entity. No API or behavior change, but requirements that reference the persistence layer are updated.
- `notice-collection`: Notice upserts performed by `runner/sync.ts` are rewritten against MikroORM unit-of-work semantics; requirement around atomic sync is clarified.
- `notice-dashboard`: Notice listing/filter queries move to MikroORM EntityManager; pagination contract unchanged.
- `notice-details`: Single-notice detail fetch and status transitions go through the MikroORM entity.
- `cron-scheduler`: Schedule persistence (`cron_expression`, `cron_enabled`) moves to the `Project` entity; reschedule-on-update behavior is preserved.

## Impact

- **Code**: `server/src/db/**`, all `server/src/routes/**`, `server/src/runner/**`, `server/src/cron/**`, `server/scripts/migrate-json-to-db.ts`, `server/package.json`, `server/drizzle.config.ts` (removed), `server/drizzle/**` (removed).
- **Dependencies**: Remove `drizzle-orm`, `drizzle-kit`. Add `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@mikro-orm/cli`, `reflect-metadata`.
- **Build/TS config**: Enable `experimentalDecorators` and `emitDecoratorMetadata` in `server/tsconfig.json`; import `reflect-metadata` at entry.
- **Migrations**: Existing drizzle migrations are retired. A single baseline MikroORM migration will be generated to match the current schema; no production data exists yet, so DB will be recreated locally via `docker compose down -v`.
- **APIs**: No external API changes. Route handlers keep the same contracts.
- **Docs**: `CLAUDE.md` Quick Start commands updated to MikroORM CLI equivalents.
