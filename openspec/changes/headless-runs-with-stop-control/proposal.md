## Why

Scraper runs currently launch a visible Chromium window (`HEADLESS: false` in `config.js`), which steals focus, blocks the operator's desktop, and prevents running Step 1 / Step 2 unattended on a server or headless host. There is also no way to abort a long-running Step 1 sweep or stuck Step 2 bulk job — the only recovery today is killing the Node server process, which also destroys the `script_runs` row's final state.

## What Changes

- Step 1 and Step 2 child processes SHALL run Chromium in headless mode by default. The manual headed "Авторизоваться" flow (browser-auth) remains unchanged.
- The runner SHALL keep a handle (PID + child reference) to every spawned script and expose a supervised way to terminate it.
- New API endpoint to cancel a running script: `POST /api/projects/:id/script-runs/:runId/stop`.
- `script_runs` gains a `cancelled` terminal status so cancelled runs are distinguishable from `error`.
- The dashboard's run history row for a running script SHALL show a "Stop" button; clicking it terminates the child and records the cancellation reason in the log.
- Cancelling the Step-1 row SHALL also stop its chained Step-2 bulk loop so no further notices are processed.

## Capabilities

### New Capabilities
- `script-run-control`: administrative control over running scraper scripts — cancellation endpoint, status lifecycle for cancelled runs, and UI affordance to stop in-flight jobs.

### Modified Capabilities
- `notice-collection`: Step-1 child process must run headless and must be cancellable mid-flight (including its auto-chained Step-2 bulk loop).
- `notice-details`: Step-2 child process must run headless and must be cancellable mid-flight.
- `full-run-history`: run history row adds a Stop action for `running` rows and renders the new `cancelled` status.

## Impact

- `config.js`: flip `HEADLESS` default to `true`; keep an override for the headed auth flow.
- `lib/browser.js`: still honours `config.HEADLESS`; no structural change beyond the default.
- `server/src/runner/runner.ts`: track spawned children in an in-memory registry keyed by `runId`; add `cancelRun(runId)` that sends SIGTERM then SIGKILL after a grace window.
- `server/src/runner/runs.ts`: check a cancellation flag between keyword iterations and between Step-2 bulk notices to stop cleanly after the current child exits.
- `server/src/db/enums.ts` + MikroORM migration: add `ScriptRunStatus.Cancelled`.
- `server/src/routes/runs.ts`: new `POST .../:runId/stop` route.
- `client/src/lib/api.ts` + `ScriptDocs.tsx`: wire the Stop button and new status badge.
- Cron-triggered runs keep working headless with no visible window on the host.
