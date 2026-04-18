## Why

Today an admin must manually trigger Step 2 after Step 1 finishes, and the notice table shows sparse metadata (ID, organizer, title, keyword, status, collected-at) without the actual business fields collected by Step 2 (amount, end date). That forces the operator to open each notice to see the information that matters for triage, and creates busywork between runs. Chaining Step 2 onto Step 1 and promoting Step-2 fields into primary columns turns the dashboard into a usable review surface instead of a job-queue console.

## What Changes

- Step 2 runs automatically for every eligible notice (`status = 'new'`) once Step 1 has completed all configured keywords. No manual "Собрать информацию для всех" click required after a scheduled or manual Step-1 run.
- **BREAKING (UI label)**: rename the per-row button "Собрать" to "Заполнить". Behavior is unchanged — it still triggers per-notice Step 2 — so downstream Step 3 can reuse it.
- **BREAKING (UI label/retention)**: keep the "Не подходит" button on each row for the upcoming Step 3 workflow; its behavior is unchanged.
- Notice table columns become: **ID** (clickable link to the notice URL from the collected details), **Название**, **Организатор**, **Сумма**, **Дата завершения**.
- Existing secondary columns (**status**, **collected-at**, **search keyword**) move into a 3-dot overflow menu in the rightmost column alongside the row actions.
- Bulk "Собрать информацию для всех" button is retained for manual re-run / recovery scenarios; auto-chaining does not remove it.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `notice-collection`: Step-1 completion MUST enqueue Step-2 bulk run for the same project after all keywords finish successfully.
- `notice-details`: bulk Step-2 is invoked automatically as a continuation of Step-1, not only on-demand; skip rules remain unchanged.
- `notice-dashboard`: table columns, row action labels ("Собрать" → "Заполнить"), and placement of status/collected-at/keyword metadata into a row-level overflow menu; ID column becomes a link to the source URL captured in `notice.details`.

## Impact

- **Backend**: `server/src/runner/runs.ts` (chain Step-2 bulk after Step-1), `server/src/cron/scheduler.ts` (scheduled runs also chain), `server/src/routes/runs.ts` (manual Step-1 trigger chains too). No new API routes; existing `/api/projects/:id/run/step2/bulk` stays for manual use. `script_runs` may gain additional rows per chained run (one for Step 1, one for Step 2 bulk, same as today if invoked sequentially).
- **Frontend**: `client/src/components/NoticeTable.tsx` column set and row-action layout; new overflow-menu component (shadcn `DropdownMenu`). `client/src/lib/api.ts` types for the notice row may need to surface `details.amount`, `details.endDate`, and `details.url` on list responses — either from existing `details` JSON or by extending the list endpoint to include parsed fields.
- **Data**: no schema changes. Relies on fields already captured in `notice.details` by Step 2. Notices with `status = 'new'` (Step 2 not yet run) will render em-dashes in the new columns until auto-chained Step 2 completes.
- **Docs**: `CLAUDE.md` architecture section, `SITE_DOCS.md` if selectors for amount/end date/URL were not already documented.
- **Operational**: scheduled Step-1 cron jobs will now hold the runner longer (Step 1 + Step 2 bulk) — must verify no overlap with the next scheduled tick.
