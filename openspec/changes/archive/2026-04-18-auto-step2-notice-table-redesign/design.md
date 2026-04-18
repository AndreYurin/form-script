## Context

`runStep1` in `server/src/runner/runs.ts` iterates over `project.searchKeywords`, runs the scraper per keyword, and syncs results into Postgres. Step 2 is only triggered today by explicit HTTP calls: per-notice (`POST /api/projects/:id/notices/:noticeId/collect`) or bulk (`POST /api/projects/:id/run/step2/bulk`). Both scheduled and manual Step-1 invocations therefore leave every freshly-upserted notice sitting in `status = 'new'` until an operator clicks "Собрать для всех".

The notice table (`client/src/components/NoticeTable.tsx`) currently surfaces: ID, Организатор, Название, Ключевое слово, Статус, Собрано, per-row "Собрать" + "Не подходит" actions. Step-2 results are stored in `notice.details` (JSON) and only visible in the side-sheet detail view. Scraped `details` payload shape is stable: `{ id, number, organizer, amount, endDate, url }` (confirmed via `data/results.json`).

Constraints:
- No schema migration allowed — the change must work against existing `notice.details` JSON.
- Legacy scripts still write to `data/*.json` first; `syncStep2Output` is the Postgres bridge. Cannot be reordered.
- `Notice` list endpoint already returns `details`, so the frontend can read Step-2 fields without a new API.
- Step-3 is upcoming; "Собрать" → "Заполнить" rename must not break any test or HTTP contract.

## Goals / Non-Goals

**Goals:**
- Step 2 executes automatically for every eligible notice at the end of Step 1, whether Step 1 was triggered manually, by cron, or via HTTP.
- Notice table makes Step-2 business fields (Сумма, Дата завершения) first-class, and makes the notice URL one click away from the ID.
- Status / collected-at / search keyword stay accessible but move out of the primary scan path.
- Preserve manual bulk-collect and per-row "Заполнить" actions as recovery + Step-3 entry points.

**Non-Goals:**
- Implementing Step 3. This change only reserves the "Не подходит" + renamed "Заполнить" buttons for it.
- Changing the `notice.details` schema or adding API fields.
- Parallelizing Step-2 runs. Existing sequential execution is retained.
- Reworking `script_runs` history UI.

## Decisions

### Decision 1: Chain Step-2 inside `runStep1`, not in each caller

`runStep1` in `server/src/runner/runs.ts` is called from three places: `routes/runs.ts` (manual HTTP), `cron/scheduler.ts` (scheduled), and (potentially) future automation. Adding the chain into every caller would duplicate the logic and risk drift.

**Chosen:** After the existing keyword loop finalizes the Step-1 `ScriptRun` row, `runStep1` invokes `runStep2Bulk(projectId)` in the same process. Errors from `runStep2Bulk` are caught and logged into the Step-1 run's `log` field but do NOT flip the Step-1 run status — Step 1 is considered successful if the ID collection succeeded even if a subsequent Step-2 item failed.

**Rejected:** Putting chaining in callers. Rejected for DRY reasons — there are three call sites today and more likely to come.

**Rejected:** Fire-and-forget the Step-2 bulk on a background promise. Rejected because scheduled runs rely on completion to avoid overlap with the next tick; orphaning a promise would make cron reasoning and error reporting fuzzy.

### Decision 2: Step-2 bulk produces its own `script_runs` rows (no change)

Current `runStep2Bulk` loops over pending notices and calls `runStep2ForNotice`, which already creates one `ScriptRun` per notice. Keep that behavior. Chaining from Step 1 does NOT bundle Step 2 into the Step-1 run row.

**Why:** History panel already groups runs by script name and can display them; merging would require a larger change to `script_runs` UI. Keeping per-notice rows also preserves the existing ability to click a notice's history.

### Decision 3: Step-2 auto-run is unconditional on Step-1 outcome

If the Step-1 keyword loop ends with `overallSuccess = false` (at least one keyword failed), Step-2 still runs on whatever notices reached `status = 'new'`. Those notices are valid regardless of a sibling keyword's failure.

**Why:** Partial Step-1 data is still useful data. Blocking Step 2 punishes operators for transient site flakiness on one keyword.

**Mitigation:** The Step-1 run log records any Step-2 bulk failures so they remain discoverable.

### Decision 4: No new API route; list endpoint already returns `details`

`GET /api/projects/:id/notices` already returns `notice.details`. The frontend reads `details.amount`, `details.endDate`, `details.url` directly. Missing fields render as "—".

**Why:** Avoid a parallel API path. Adding denormalized columns would be premature until a second consumer needs them.

### Decision 5: Add shadcn `DropdownMenu` for the 3-dot overflow

The project already uses shadcn primitives (`Button`, `Dialog`, `Badge`, `Switch`). No dropdown primitive exists. Add one to `client/src/components/ui/dropdown-menu.tsx` backed by `@radix-ui/react-dropdown-menu`. Use it on each row's rightmost column to host: status badge, collected-at, search keyword (read-only info items, not actions).

The row-level actions ("Заполнить", "Не подходит") stay as visible buttons alongside — they are primary actions, not metadata.

**Rejected alternative:** Hover tooltip on a status badge. Rejected because search keyword and collected-at are also moved; the overflow must hold multiple fields cleanly.

### Decision 6: ID cell is an external link

The ID becomes an `<a>` with `href = notice.details?.url`, falling back to the documented URL pattern `https://goszakup.gov.kz/ru/announce/index/{noticeId}` when `details.url` is absent (e.g., Step 2 not yet run). Opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). The detail side-sheet remains reachable via clicking the title.

**Why:** ID is the natural anchor for "open the source page"; title already opens the in-app detail. Splitting the two click targets matches the user mental model without stealing existing behavior.

### Decision 7: Bulk "Собрать для всех" button is kept, label unchanged

Auto-chaining handles the common case. The manual bulk button stays for recovery (e.g., after a Step-2 failure sweep) and for Step-3 operators who may want to re-run Step 2 before triggering Step 3.

**Rejected:** Removing the button. Would remove a recovery affordance.

## Risks / Trade-offs

- **[Risk]** Scheduled Step-1 + auto Step-2 can run longer than the cron interval, causing overlap or missed ticks. → **Mitigation:** node-cron does not queue; a running job naturally blocks the next tick. Document in `CLAUDE.md` that cron expressions must leave enough headroom for a full Step-2 sweep. No code-level lock added in this change.
- **[Risk]** Existing notices with `status = 'new'` but never-run Step 2 now render em-dashes in Сумма/Дата, which may look like data loss. → **Mitigation:** manual bulk button still produces a fast fill; status badge in overflow menu confirms the state.
- **[Risk]** ID link falls back to a reconstructed URL when Step 2 hasn't run. If goszakup changes its URL structure, the fallback breaks silently. → **Mitigation:** prefer `details.url` when present; document the fallback in `SITE_DOCS.md`.
- **[Trade-off]** Chaining inside `runStep1` couples Step-1 and Step-2 execution paths more tightly. Acceptable for a local admin tool; would revisit if/when these become independent services.
- **[Trade-off]** Reading `details` as `Record<string, unknown>` on the frontend requires narrowing helpers. Keep a small local `extractNoticeSummary(notice)` utility rather than widening the `Notice` type until the shape settles.

## Migration Plan

1. Add `@radix-ui/react-dropdown-menu` to `client/package.json`; create `components/ui/dropdown-menu.tsx`.
2. Update `runner/runs.ts::runStep1` to call `runStep2Bulk` after finalizing the run row.
3. Update `NoticeTable.tsx` columns and row layout; add overflow menu.
4. Update any backend/frontend tests (run lookup assertions, row contents) to match new shape.
5. Verify via Playwright MCP: trigger manual Step 1, confirm Step 2 runs automatically and table fills with Сумма/Дата; confirm "Заполнить" still drives per-notice Step 2; confirm ID link opens the goszakup page.

No database migration required. Rollback = revert commits; no data transform needed.

## Open Questions

- None blocking. If Step-2 auto-chain failure telemetry becomes noisy, consider splitting the Step-1 run row into a parent/child structure — deferred out of this change.
