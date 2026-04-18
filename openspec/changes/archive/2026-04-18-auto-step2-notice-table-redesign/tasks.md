## 1. Backend — Auto-chain Step 2 after Step 1

- [x] 1.1 In `server/src/runner/runs.ts::runStep1`, after the keyword loop finalizes the Step-1 `ScriptRun` row, invoke `runStep2Bulk(projectId)` in the same async path
- [x] 1.2 Wrap the chained `runStep2Bulk` call in try/catch; on error, append the failure message to the Step-1 run's `log` field without flipping its `status` from `success`
- [x] 1.3 Ensure chaining runs unconditionally on `overallSuccess` — partial keyword failures must not block the bulk Step-2 sweep
- [x] 1.4 Confirm `runStep2Bulk` continues to create one `ScriptRun` per notice (no bundling into the Step-1 row) and that scheduled cron ticks await full completion before resolving
- [x] 1.5 Verify all three Step-1 entry points (manual `routes/runs.ts`, scheduled `cron/scheduler.ts`, and any other caller) inherit the chaining via `runStep1` — no per-caller duplication

## 2. Frontend — Dropdown primitive

- [x] 2.1 Add `@radix-ui/react-dropdown-menu` to `client/package.json` and install
- [x] 2.2 Create `client/src/components/ui/dropdown-menu.tsx` wrapping the Radix primitive, matching existing shadcn-style API used by `button.tsx`, `dialog.tsx`, etc.

## 3. Frontend — Notice table redesign

- [x] 3.1 In `client/src/components/NoticeTable.tsx`, replace the column set with: **ID**, **Название**, **Организатор**, **Сумма**, **Дата завершения**, plus a rightmost overflow column
- [x] 3.2 Render the **ID** cell as `<a target="_blank" rel="noopener noreferrer">` using `notice.details?.url`, falling back to `https://goszakup.gov.kz/ru/announce/index/{noticeId}` when `details.url` is absent
- [x] 3.3 Add a small local `extractNoticeSummary(notice)` helper that narrows `notice.details` and returns `{ amount, endDate, url }`; render `—` for missing values
- [x] 3.4 Keep the **Название** cell as the in-app detail trigger (existing side-sheet behavior)
- [x] 3.5 In the rightmost column, render the row actions **"Заполнить"** (renamed from "Собрать", same handler that triggers per-notice Step 2) and **"Не подходит"** (unchanged behavior, reserved for Step 3) as visible buttons
- [x] 3.6 Add a 3-dot trigger next to the row actions that opens the new `DropdownMenu`, listing read-only metadata: **Status** (badge), **Собрано** (collected-at, formatted), **Ключевое слово** (search keyword)
- [x] 3.7 Retain the bulk "Собрать информацию для всех" button at the table header level; do not change its label or handler

## 4. Tests & verification

- [x] 4.1 Update any backend tests that assert on Step-1 run completion shape or call counts to reflect the chained Step-2 invocation
- [x] 4.2 Update any frontend tests that snapshot the notice table columns or assert on the "Собрать" button label
- [ ] 4.3 Manual verification via Playwright MCP: trigger manual Step 1, confirm Step 2 auto-runs and notices populate `Сумма` / `Дата завершения` without further clicks
- [x] 4.4 Manual verification: click **ID** on a populated row, confirm the goszakup announce page opens in a new tab using `details.url`
- [x] 4.5 Manual verification: click **ID** on a `status = 'new'` row (no `details.url`), confirm the fallback URL pattern resolves to a valid goszakup page
- [x] 4.6 Manual verification: open the row 3-dot menu, confirm Status / Собрано / Ключевое слово are visible and readable
- [ ] 4.7 Manual verification: click **Заполнить** on a single row, confirm per-notice Step 2 still runs and updates the row in place
- [ ] 4.8 Manual verification: trigger the bulk "Собрать информацию для всех" button, confirm it still works for recovery scenarios

## 5. Documentation

- [x] 5.1 Update `CLAUDE.md` architecture section to note that Step-1 runs (manual + cron) now auto-chain Step-2 bulk, and that cron expressions must leave headroom for a full Step-2 sweep to avoid overlap
- [x] 5.2 Update `SITE_DOCS.md` with the documented fallback URL pattern (`https://goszakup.gov.kz/ru/announce/index/{noticeId}`) and confirm selectors for `amount`, `endDate`, and `url` are recorded
