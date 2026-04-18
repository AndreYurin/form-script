## 1. Headless mode for Step 1 and Step 2

- [x] 1.1 Add `--headed` CLI flag parsing to `step1-collect-ids.js` (default false → headless)
- [x] 1.2 Add `--headed` CLI flag parsing to `step2-collect-details.js` (default false → headless)
- [x] 1.3 Extend `lib/browser.js` `launchBrowser()` to accept `{ headless?: boolean }` that overrides `config.HEADLESS`
- [x] 1.4 Leave `config.HEADLESS` as-is (still consumed by the headed auth flow); document the override path in a code comment
- [ ] 1.5 Verify locally via Playwright MCP that headless Step 1 still finds results on goszakup.gov.kz for a sample keyword
- [ ] 1.6 Verify locally via Playwright MCP that headless Step 2 still scrapes details for a sample notice ID

## 2. Cancelled terminal status

- [x] 2.1 Add `Cancelled = 'cancelled'` to `ScriptRunStatus` in `server/src/db/enums.ts`
- [x] 2.2 Generate MikroORM migration that widens the `script_runs.status` check constraint to include `'cancelled'`
- [ ] 2.3 Run migration locally and verify schema via `\d script_runs`

## 3. Runner child registry and cancellation

- [x] 3.1 Introduce `runningChildren: Map<number, ChildProcess>` and `cancelledRuns: Set<number>` module state in `server/src/runner/runner.ts`
- [x] 3.2 Register each spawned child keyed by its `runId` (both new and existingRunId paths) and delete on `close`
- [x] 3.3 Export `cancelRun(runId)` that: checks the child exists and has not exited, sends SIGTERM, schedules SIGKILL after 5s, and marks `cancelledRuns` so loops bail
- [x] 3.4 Update `runStep1` to check `cancelledRuns.has(runId)` between keyword iterations; append `[cancelled]` to the log and skip remaining keywords + chained Step-2 on cancel
- [x] 3.5 Update `runStep2Bulk` to accept an optional "parent run id" and check `cancelledRuns` for either its own per-notice run or the parent between iterations, exiting cleanly when cancelled
- [x] 3.6 On cancel, finalize the affected `script_runs` row(s) with `status = 'cancelled'` and `finished_at = now()` when they are still in `running`

## 4. Cancellation API

- [x] 4.1 Add `POST /api/projects/:id/script-runs/:runId/stop` route in `server/src/routes/runs.ts`
- [x] 4.2 Return `409 Conflict` when the target row is not in `running`
- [x] 4.3 Return `200 { ok: true, alreadyFinished: true }` when the child already exited between lookup and signal
- [x] 4.4 Return `200 { ok: true }` on successful cancellation

## 5. Dashboard UI

- [x] 5.1 Extend `client/src/lib/api.ts` with `stopRun(projectId, runId)` helper
- [x] 5.2 Add a "Stop" button in `ScriptDocs.tsx` for rows where `status === 'running'`, wired to a mutation that invalidates the paginated runs query on success
- [x] 5.3 Render a distinct "Отменён" badge for `status === 'cancelled'` (neutral variant, not the red error variant)
- [x] 5.4 Surface server-side 409/500 errors from the stop mutation via a toast or inline message

## 6. Verification

- [ ] 6.1 Start a real Step-1 run locally, click Stop mid-flight, confirm the row ends as `cancelled` and the chained Step-2 does not start
- [ ] 6.2 Start a real bulk Step-2 run, click Stop after the first child finishes, confirm the remaining children are not spawned
- [ ] 6.3 Confirm an unattended cron tick completes Step 1 + Step 2 with no visible Chromium window
- [ ] 6.4 Smoke-test the headed auth flow to ensure it still opens a visible browser (regression guard)
- [ ] 6.5 Update `SITE_DOCS.md` / `CLAUDE.md` if any operator-facing behaviour notes need to change
