## Context

Today `config.js` sets `HEADLESS: false`, so every Step-1 and Step-2 child process pops a visible Chromium window. This is fine on a dev laptop sitting in front of the operator, but it:

- steals foreground focus on each keyword sweep (there are many — one per keyword plus a screenshot phase),
- prevents running the server on a headless host or over SSH,
- mixes the scraper browser with the admin's browser session.

The runner (`server/src/runner/runner.ts`) already spawns child processes via `node:child_process.spawn` and writes stdout/stderr into a `ScriptRun` row, but it does not retain a reference to the spawned child after `spawn()` returns. Once the runner promise is awaited there is no supervisory handle — the only way to stop a misbehaving run is to kill the entire Express process.

Operators need to cancel a stuck run (e.g., site is down, bulk loop takes too long, wrong keyword) without losing the partial run history.

## Goals / Non-Goals

**Goals:**
- Default Step-1 / Step-2 child processes to headless Chromium.
- Keep the manual authorization flow (`POST /api/projects/:id/authorize`) headed — that flow literally exists so the operator can log in by hand.
- Provide a cancellation API + UI for any `ScriptRun` with `status = running`.
- Record cancellation as a first-class terminal state (`cancelled`) distinct from `error`.
- Ensure cancelling a Step-1 row also stops its auto-chained Step-2 bulk loop.

**Non-Goals:**
- No pause/resume. Cancellation is terminal.
- No distributed run control — the runner registry lives in-process on the single Express server.
- No retroactive cancellation of `ScriptRun` rows that already finalized as `success` or `error`.
- No change to the headed `browser-auth` capability.

## Decisions

### 1. Toggle headless via script CLI flag, not global `config.HEADLESS`

`lib/browser.js` is shared by `step1`, `step2`, and the headed auth flow. Flipping `config.HEADLESS = true` globally would break headed auth.

Instead, `step1-collect-ids.js` and `step2-collect-details.js` will accept `--headed` as an opt-out flag and default to headless. `launchBrowser()` gains an argument that wins over the global config.

**Alternative considered:** Environment variable `HEADLESS=true`. Rejected because scripts are invoked through the runner which already assembles an `args` array; a CLI flag keeps the convention consistent with the existing `--keyword` and `--screenshot-path` flags.

### 2. In-memory child registry keyed by `runId`

`runner.ts` will keep `runningChildren: Map<number, ChildProcess>`. On spawn, insert; on `close`, delete. `cancelRun(runId)` looks up the child and sends `SIGTERM`, then `SIGKILL` after 5s if the process has not exited.

**Alternative considered:** Writing PID to the `script_runs` row and killing by PID. Rejected because it couples persistence to process lifecycle and does not survive server restart anyway — a server restart already kills the child, so the DB-persisted PID is stale the moment the server comes back.

### 3. Cancellation flag for in-loop checks

Step-1 runs a keyword loop and then an auto-chained Step-2 bulk loop. Killing the current child is not sufficient — the next iteration would spawn a new child.

Solution: alongside the child registry, keep `cancelledRuns: Set<number>`. `runStep1` and `runStep2Bulk` check the set between iterations and bail out, appending `[cancelled]` to the log and finalizing status as `cancelled`. Cancelling the Step-1 row also adds any in-flight chained Step-2 `runId`s to the same set.

### 4. New `ScriptRunStatus.Cancelled` enum value

Distinguishing cancelled from error matters for the operator ("did the site break or did I stop it?"). Requires a MikroORM migration that widens the enum check constraint.

### 5. UI: Stop button on running rows

`ScriptDocs.tsx` already renders status badges. Add a `<Button variant="destructive" size="sm">Stop</Button>` when `status === 'running'`. Clicking fires `POST /api/projects/:id/script-runs/:runId/stop`, which invalidates the runs query.

## Risks / Trade-offs

- **Risk**: Headless mode can trigger different bot-detection behavior on goszakup.gov.kz than headed mode. → **Mitigation**: keep `--disable-blink-features=AutomationControlled` and the headed-auth profile cookies; add `--headed` override for debugging.
- **Risk**: SIGTERM on Node doesn't always propagate to the Chromium subprocess spawned by Playwright, leaving orphaned browsers. → **Mitigation**: use `detached: false` (default) and a second-stage SIGKILL after the 5s grace window; Playwright's persistent context already cleans up on SIGKILL of the parent.
- **Risk**: Cancellation flag race — a child finishes normally microseconds before we SIGTERM it. → **Mitigation**: check `child.exitCode === null` before signalling; if the child already exited, just mark the row `cancelled` if it has not yet been finalized.
- **Trade-off**: We do not support cancelling mid-notice in Step 2 — the child for that one notice finishes (or is SIGKILLed) before the loop exits. That keeps DB state consistent and is acceptable since each Step-2 child is short.

## Migration Plan

1. Ship MikroORM migration adding `'cancelled'` to the `script_runs.status` check constraint.
2. Deploy server + client together — client sends Stop button requests; server handles both the new cancel endpoint and the legacy enum gracefully.
3. No data backfill needed; existing rows keep their current statuses.
4. Rollback: revert migration (enum value removed) and revert server/client. Since no existing row will have status `cancelled` unless generated after the new deployment, rollback simply requires clearing any such rows (expected to be rare and operator-initiated).
