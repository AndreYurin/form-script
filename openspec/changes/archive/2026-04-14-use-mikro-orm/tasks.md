## 1. Dependencies & TypeScript Config

- [x] 1.1 Add `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@mikro-orm/cli`, and `reflect-metadata` to `server/package.json`
- [x] 1.2 Enable `experimentalDecorators` and `emitDecoratorMetadata` in `server/tsconfig.json`
- [x] 1.3 Import `reflect-metadata` once at the top of `server/src/index.ts`
- [x] 1.4 Add `"mikro-orm"` config key to `server/package.json` pointing at `src/mikro-orm.config.ts`

## 2. Entities & Enums

- [x] 2.1 Create `server/src/db/enums.ts` with `NoticeStatus` and `ScriptRunStatus` string enums
- [x] 2.2 Create `server/src/db/entities/project.ts` with fields and `OneToMany` to `Notice` / `ScriptRun`
- [x] 2.3 Create `server/src/db/entities/notice.ts` with `ManyToOne` to `Project`, `@Enum` status, unique `(project, noticeId)`
- [x] 2.4 Create `server/src/db/entities/script-run.ts` with `ManyToOne` to `Project` and optional `ManyToOne` to `Notice`
- [x] 2.5 Verify entity metadata compiles via `tsc --noEmit`

## 3. ORM Bootstrap & Config

- [x] 3.1 Create `server/src/mikro-orm.config.ts` exporting `Options` (driver, entities, migrations, seeder, debug flag)
- [x] 3.2 Replace `server/src/db/client.ts` with `MikroORM.init()` bootstrap exporting `orm` and `em`
- [x] 3.3 Install `RequestContext` middleware in `server/src/index.ts` before the API router
- [x] 3.4 Add typed helper/type augmentation so routes can access the forked EM per request

## 4. Baseline Migration

- [x] 4.1 Delete `server/drizzle/` directory and `server/drizzle.config.ts`
- [x] 4.2 Run `mikro-orm migration:create --initial` to generate baseline migration matching current schema
- [x] 4.3 Verify the generated SQL creates `projects`, `notices`, `script_runs`, enums, and unique `(project_id, notice_id)` constraint
- [x] 4.4 Replace `db:generate` / `migrate` scripts in `server/package.json` with MikroORM CLI equivalents

## 5. Port Routes

- [x] 5.1 Port `server/src/routes/projects.ts` to use the request EM
- [x] 5.2 Port `server/src/routes/notices.ts` to use the request EM
- [x] 5.3 Port `server/src/routes/runs.ts` to use the request EM
- [x] 5.4 Port `server/src/routes/auth.ts` to use the request EM
- [x] 5.5 Confirm every route response shape is unchanged

## 6. Port Runner & Cron

- [x] 6.1 Port `server/src/runner/runner.ts` to use a forked EM with explicit transaction
- [x] 6.2 Rewrite `server/src/runner/sync.ts` as a single unit-of-work: find, mutate, single `flush()`, preserving skip rules for `rejected` / `details_collected`
- [x] 6.3 Port `server/src/runner/runs.ts` (`runStep1`, `runStep2ForNotice`, `runStep2Bulk`) to forked EMs
- [x] 6.4 Port `server/src/cron/scheduler.ts` to fork an EM inside each cron callback

## 7. Seeder & JSON Importer

- [x] 7.1 Rewrite `server/src/db/seed.ts` using MikroORM entity creation
- [x] 7.2 Rewrite `server/scripts/migrate-json-to-db.ts` using a forked EM and unit-of-work
- [x] 7.3 Verify `db:seed` and `db:migrate-json` scripts still run end-to-end

## 8. Cleanup & Docs

- [x] 8.1 Remove `drizzle-orm` and `drizzle-kit` from `server/package.json`
- [x] 8.2 Update `CLAUDE.md` Quick Start commands to reference MikroORM CLI
- [x] 8.3 Update architecture section of `CLAUDE.md` to describe entities + request-scoped EM
- [x] 8.4 Run `npm install` and commit updated lockfile

## 9. Local Verification

- [x] 9.1 `docker compose down -v && docker compose up -d` to reset local Postgres
- [x] 9.2 Run migration, seed, and JSON import scripts successfully
- [x] 9.3 `npm run dev` — load dashboard, trigger Step 1 and Step 2, verify notices and script_runs populate
- [x] 9.4 Confirm cron reschedule via UI still fires and writes script_runs
