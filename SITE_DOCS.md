# Site Documentation: goszakup.gov.kz

## Overview

Portal of government procurement of the Republic of Kazakhstan.
URL: https://goszakup.gov.kz

## Search Page

**URL pattern:**
```
https://goszakup.gov.kz/ru/search/announce?filter[name]=...&filter[status][]=210&...
```

**Filter parameters:**
| Parameter | Description |
|-----------|-------------|
| `filter[name]` | Keyword in announcement name |
| `filter[customer]` | Customer/buyer name |
| `filter[number]` | Announcement number |
| `filter[year]` | Year |
| `filter[status][]` | Status codes (210=published, 220=accepting apps, 240=evaluation) |
| `filter[amount_from]` / `filter[amount_to]` | Amount range |
| `filter[trade_type]` | Trade type |
| `filter[start_date_from]` / `filter[start_date_to]` | Start date range |
| `filter[end_date_from]` / `filter[end_date_to]` | End date range |
| `filter[itog_date_from]` / `filter[itog_date_to]` | Result date range |

**Status codes:**
| Code | Meaning |
|------|---------|
| 210 | Опубликовано (Published) |
| 220 | Приём заявок (Accepting applications) |
| 240 | Рассмотрение заявок (Evaluating applications) |

### HTML Structure (search results)

- Uses jQuery DataTables plugin with `paging: false` (DataTables paging disabled)
- **Pagination is server-side** via `page=` and `count_record=` URL parameters
- Table: `<table id="search-result" class="table table-bordered table-striped dataTable responsive no-footer">`
- Each data row: `<tr role="row">` inside `<tbody>`
- Row contents (7 columns):
  1. **№** — `<td><strong>16776705-1</strong><br><small>Лотов: 6</small></td>`
  2. **Наименование объявления** — `<td><a href="/ru/announce/index/16776705">Title</a><br><small><b>Организатор:</b> Name</small></td>`
  3. **Способ** — Procurement method (plain text)
  4. **Начало приема заявок** — Start date `<td nowrap>2026-04-15<br>22:46:05</td>`
  5. **Окончание приема заявок** — End date `<td nowrap>2026-04-30<br>22:46:10</td>`
  6. **Сумма, тг.** — `<td nowrap><strong>710 338.80</strong></td>`
  7. **Статус** — Status text

### Selectors used by scraper

| Element | Selector |
|---------|----------|
| Data rows | `#search-result tbody tr` |
| Announcement number | `td:first-child strong` (text e.g. `16776705-1`) |
| Organizer | `td:nth-child(2) small` (text starts with `Организатор:`) |
| Announcement link | `td:nth-child(2) a[href]` (href = `/ru/announce/index/{id}`) |

### Pagination

- Server-side: 50 records per page by default
- Info text: `"Показано c 1 по 50 из 79 записей"`
- Navigation: `<ul class="pagination">` with `«` (prev) and `»` (next)
- Disabled state: `href="javascript:void(0)"` — active link has real URL with `page=N`
- No client-side per-page selector (DataTables `pageLength` and `paging` are cosmetic)

### Organizer field

Located inside each row in the second `<td>` as:
```html
<small class="hidden-xs">
  <b>Организатор:</b> ГКП "Школа-лицей №15"
</small>
```

## Announcement Detail Page

**URL pattern:**
```
https://goszakup.gov.kz/ru/announce/index/{id}
```

Where `{id}` is the numeric part before the dash (e.g. `16776705` from `16776705-1`).

### Page Structure

The page has tabs:
1. **Общие сведения** (General info) — default active tab
2. **Лоты** (Lots)
3. **Документация** (Documentation)
4. **Обсуждение положений документации** (Documentation discussion)
5. **Протоколы** (Protocols)
6. **Договоры** (Contracts)
7. **Апелляции** (Appeals)

### Key Fields in "Общие сведения"

| Field | `<th>` label | Value format / notes |
|-------|-------------|----------------------|
| Procurement method | Способ проведения закупки | Plain text |
| Purchase type | Тип закупки | "Первая закупка" etc. |
| Subject type | Вид предмета закупок | "Товар" etc. |
| Organizer | Организатор | BIN (12 digits) + space + legal name |
| Legal address | Юр. адрес организатора | Full address string |
| Lot count | Кол-во лотов в объявлении | Integer |
| Amount | Сумма закупки | Numeric with spaces, e.g. `710 338.80` |
| Flags | Признаки | "Без учета НДС" etc. |
| Representative | ФИО представителя | Full name |
| Position | Должность | Role |
| Email | E-Mail | Contact email |

### Date fields (separate from the table)

Dates are **not** in the `<th>/<td>` table. They are in a form above the tabs:
```html
<div class="form-group">
  <label class="col-sm-4 control-label">Срок окончания приема заявок</label>
  <div class="col-sm-7">
    <input type="text" class="form-control" value="2026-04-30 22:46:10" readonly="">
  </div>
</div>
```

Three date fields exist:
1. **Дата публикации** — publication date
2. **Начало приема заявок** — application start
3. **Срок окончания приема заявок** — application deadline (the one we collect)

### Selectors used by scraper

| Element | Extraction method |
|---------|-------------------|
| All key-value fields | `document.querySelectorAll('tr')` → `th.textContent` / `td.textContent` |
| Organizer name | `fieldMap['Организатор']`, strip leading 12-digit BIN |
| Amount | `fieldMap['Сумма закупки']` |
| End date | Find `<label>` containing "Срок окончания приема заявок" → parent `.form-group` → `<input>` value |
| Number | From URL / step 1 data |

## REST API (alternative approach)

The site provides an official REST API at `https://ows.goszakup.gov.kz/v2/`.

**Key endpoints:**
| Endpoint | Description |
|----------|-------------|
| `/v2/trd-buy` | Announcements list |
| `/v2/lots` | Lots registry |
| `/v2/contract` | Contracts registry |
| `/v2/subject` | Participants registry |
| `/v2/graphql` | GraphQL interface |

**Authentication:** Bearer token required. Obtained from АО «Центр электронных финансов»
by submitting a request describing intended use. Tokens valid for 1 year.

**Response format:** JSON with pagination:
```json
{
  "total": 1234,
  "limit": 50,
  "next_page": "/v2/trd-buy?limit=50&next_page=...",
  "items": [...]
}
```

## Notes

- The site uses Cloudflare or similar protection; automated requests may be
  challenged. Using a persistent browser context with cookies helps avoid this.
- Some pages/tabs may require authentication to view full details.
- The site is available in Russian (`/ru/`) and Kazakh (`/kk/`).
