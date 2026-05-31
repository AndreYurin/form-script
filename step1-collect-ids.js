/**
 * Step 1 — Collect announcement IDs from the search page.
 *
 * Required arg:
 *   --keyword <text>          Search term to fill into "Наименование объявления" field.
 *
 * Optional arg:
 *   --screenshot-path <path>  When provided, takes a screenshot after search results load,
 *                             saves it to the given path, then exits WITHOUT collecting IDs.
 *   --headed                  Launch Chromium with a visible window (default: headless).
 *
 * Required env:
 *   STEP1_ORGANIZER_FILTERS   JSON array of substrings. A row's «Организатор» field must
 *                             contain at least one of these (case-insensitive) to be kept.
 *                             If the array is empty, every row is kept.
 *
 * Optional env:
 *   STEP1_AMOUNT_FROM         Numeric. If set (and > 0), fills the «Сумма закупки с»
 *                             field (input[name="filter[amount_from]"]) before submit.
 *
 * Search form selector for amount field:
 *   - "Сумма закупки с" input: input[name="filter[amount_from]"] (id="in_amount_from")
 *
 * Site structure (search results page):
 *   - Table with id="search-result" and DataTables wrapper
 *   - Each row: <tr> inside <tbody>
 *   - Columns: №, Наименование / Организатор, Способ, Даты, Сумма, Статус
 *   - td[1] contains the title text directly, followed by <small><b>Организатор:</b> Name</small>
 *   - Pagination: links inside .pagination
 *   - "Показано c X по Y из Z записей" — total record indicator
 *
 * Search form selectors:
 *   - "Наименование объявления" input: input[name="filter[name]"]
 *   - "Статус" select (210, 220, 240): select[name="filter[status][]"]
 *   - "Предмет закупки" select, fixed to "s" (Услуга): select[name="filter[trade_type]"]
 *   - Submit button: button[type="submit"] or button.smb inside the filter form
 *   - "Показывать по" page-size select (no name/id): select[onchange*="ajax_set_count_record"]
 *     Triggers an AJAX POST that sets the per-session row count, then location.reload(true).
 *   - Results table: #search-result tbody tr
 */

const config = require('./config');
const { launchBrowser } = require('./lib/browser');
const { readJSON, writeJSON } = require('./lib/files');
const log = require('./lib/logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Read organizer filter substrings from STEP1_ORGANIZER_FILTERS env var.
 * Returns a lowercase string[]. Empty array means "no filter — keep every row".
 */
function parseOrganizerFilters() {
  const raw = process.env.STEP1_ORGANIZER_FILTERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => typeof s === "string")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  } catch (err) {
    log.warn(`STEP1_ORGANIZER_FILTERS is not valid JSON, ignoring: ${err.message}`);
    return [];
  }
}

function organizerMatches(organizer, filters) {
  if (filters.length === 0) return true;
  const lower = (organizer || "").toLowerCase();
  return filters.some((f) => lower.includes(f));
}

/**
 * Read STEP1_AMOUNT_FROM env var. Returns null when unset/blank or unparseable,
 * otherwise a non-negative integer string ready to type into the form.
 */
function parseAmountFrom() {
  const raw = process.env.STEP1_AMOUNT_FROM;
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    log.warn(`STEP1_AMOUNT_FROM is not a non-negative number, ignoring: ${raw}`);
    return null;
  }
  return String(Math.floor(n));
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { keyword: null, screenshotPath: null, headed: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keyword' && args[i + 1]) {
      result.keyword = args[i + 1];
      i++;
    } else if (args[i] === '--screenshot-path' && args[i + 1]) {
      result.screenshotPath = args[i + 1];
      i++;
    } else if (args[i] === '--headed') {
      result.headed = true;
    }
  }

  return result;
}

/**
 * Navigate to the base search page, fill in keyword, select status checkboxes,
 * click "Найти", and wait for results table.
 */
async function performSearch(page, keyword) {
  const BASE_SEARCH_URL = 'https://goszakup.gov.kz/ru/search/announce';

  log.info(`Navigating to base search page...`);
  await page.goto(BASE_SEARCH_URL, {
    waitUntil: 'domcontentloaded',
    timeout: config.PAGE_LOAD_TIMEOUT,
  });

  await sleep(2000); // let page fully initialize

  log.info(`Filling keyword: "${keyword}"`);
  const nameInput = page.locator('input[name="filter[name]"]');
  await nameInput.waitFor({ timeout: config.PAGE_LOAD_TIMEOUT });
  await nameInput.fill(keyword);

  // Optional: "Сумма закупки с" minimum-amount filter.
  const amountFrom = parseAmountFrom();
  if (amountFrom) {
    log.info(`Filling minimum amount (Сумма закупки с): ${amountFrom}`);
    const amountInput = page.locator('input[name="filter[amount_from]"]');
    await amountInput.waitFor({ timeout: config.PAGE_LOAD_TIMEOUT });
    await amountInput.fill(amountFrom);
  }

  // Select statuses in the multi-select: 210 Опубликовано, 220 прием заявок, 240 прием ценовых предложений
  await page.selectOption('select[name="filter[status][]"]', ['210', '220', '240']);
  log.info('Selected statuses: 210, 220, 240');

  // «Предмет закупки» = Услуга (value "s"). Hardcoded, like status above.
  await page.selectOption('select[name="filter[trade_type]"]', 's');
  log.info('Selected trade_type: s (Услуга)');

  log.info('Clicking search button...');
  const submitBtn = page.locator('button[type="submit"]:has-text("Найти")');
  await submitBtn.click();

  // Wait for results table
  await page.waitForSelector('#search-result tbody tr', {
    timeout: config.PAGE_LOAD_TIMEOUT,
  });

  await sleep(config.NAV_DELAY);
  log.info('Search results loaded.');

  await setMaxPageSize(page);
}

/**
 * Switch the "Показывать по" length selector to its largest value so we paginate
 * through fewer pages. The select has no name/id but a unique onchange handler.
 * Changing it fires ajax_set_count_record() → POST → location.reload(true), so
 * we await the navigation and re-wait for the results table.
 */
async function setMaxPageSize(page) {
  const lengthSel = page.locator('select[onchange*="ajax_set_count_record"]');
  if ((await lengthSel.count()) === 0) {
    log.warn('Page-size selector not found, keeping site default.');
    return;
  }

  const options = await lengthSel.locator('option').evaluateAll((els) =>
    els.map((el) => parseInt(el.getAttribute('value') || '', 10)).filter((n) => Number.isFinite(n)),
  );
  if (options.length === 0) {
    log.warn('Page-size selector has no options, keeping site default.');
    return;
  }

  const target = String(Math.max(...options));
  const current = await lengthSel.inputValue().catch(() => '');
  if (current === target) {
    log.info(`Page size already at max (${target}).`);
    return;
  }

  log.info(`Setting page size: ${current || '?'} → ${target}`);
  try {
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: config.PAGE_LOAD_TIMEOUT,
      }),
      lengthSel.selectOption(target),
    ]);
    await page.waitForSelector('#search-result tbody tr', {
      timeout: config.PAGE_LOAD_TIMEOUT,
    });
    await sleep(config.NAV_DELAY);
  } catch (err) {
    log.warn(`Failed to apply page size ${target}: ${err.message}. Continuing with default.`);
  }
}

/**
 * Parse a single page of search results.
 * Returns an array of { id, number, organizer, title } for all rows.
 */
async function parseSearchPage(page) {
  const tableSelector = '#search-result tbody tr';
  try {
    await page.waitForSelector(tableSelector, { timeout: config.PAGE_LOAD_TIMEOUT });
  } catch {
    log.error(
      'Cannot find results table on the page. The site structure may have changed.\n' +
      'Expected selector: ' + tableSelector
    );
    return null;
  }

  const rows = await page.$$(tableSelector);
  if (rows.length === 0) {
    log.warn('Table found but contains zero rows.');
    return [];
  }

  const matches = [];
  const organizerFilters = parseOrganizerFilters();

  for (const row of rows) {
    // Extract announcement number from first <td> > <strong>
    const numEl = await row.$('td:first-child strong');
    const numText = numEl ? (await numEl.innerText()).trim() : '';
    const numberMatch = numText.match(/(\d[\d-]+)/);
    if (!numberMatch) continue;

    const fullNumber = numberMatch[1]; // e.g. "16776705-1"
    const id = fullNumber.split('-')[0]; // e.g. "16776705"

    // Extract organizer from <small> inside second <td>
    // Structure: <td> Title text <small><b>Организатор:</b> OrgName</small></td>
    const secondTd = await row.$('td:nth-child(2)');
    if (!secondTd) continue;

    const orgEl = await secondTd.$('small');
    const orgText = orgEl ? await orgEl.innerText().catch(() => '') : '';
    const organizer = orgText.replace(/^Организатор:\s*/i, '').trim();

    // Extract title: full text of second td, then strip the organizer small tag text
    const fullTdText = await secondTd.innerText().catch(() => '');
    const title = fullTdText
      .replace(orgText, '')
      .replace(/Организатор:\s*/i, '')
      .trim()
      .split('\n')[0]
      .trim();

    if (!organizerMatches(organizer, organizerFilters)) {
      log.info(`Skipped (organizer no match): ${fullNumber} — ${organizer.substring(0, 80)}`);
      continue;
    }

    matches.push({ number: fullNumber, id, organizer, title });
    log.ok(`Found: ${fullNumber} — ${(organizer || title || '').substring(0, 80)}`);
  }

  return matches;
}

/**
 * Get total records count from page text like "Показано c 1 по 50 из 79 записей".
 */
async function getTotalInfo(page) {
  const infoText = await page
    .locator('text=/Показано/i')
    .first()
    .innerText()
    .catch(() => '');

  const m = infoText.match(/из\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Navigate to the next page. Returns true if navigation happened, false if last page.
 */
async function goNextPage(page) {
  const nextLink = page.locator('.pagination li:last-child a');
  if ((await nextLink.count()) === 0) return false;

  const href = await nextLink.getAttribute('href').catch(() => '');
  if (!href || href.includes('javascript:void')) return false;

  await nextLink.click();
  await page.waitForLoadState('domcontentloaded', { timeout: config.PAGE_LOAD_TIMEOUT });
  await sleep(config.NAV_DELAY);
  return true;
}

async function main() {
  const { keyword, screenshotPath, headed } = parseArgs();

  if (!keyword) {
    log.error('Missing required argument: --keyword <text>');
    process.exit(1);
  }

  const organizerFilters = parseOrganizerFilters();
  const amountFromBanner = parseAmountFrom();
  log.info(
    `=== Step 1: Collecting announcement IDs (keyword: "${keyword}", ` +
      `organizer filters: ${organizerFilters.length === 0 ? "—" : organizerFilters.join(", ")}, ` +
      `amount from: ${amountFromBanner ?? "—"}) ===`,
  );

  const context = await launchBrowser({ headless: !headed });
  const page = await context.newPage();

  try {
    await performSearch(page, keyword);
  } catch (err) {
    log.error(`Failed during search: ${err.message}`);
    await context.close();
    process.exit(1);
  }

  // Screenshot-only mode: take screenshot and exit
  if (screenshotPath) {
    log.info(`Taking screenshot → ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log.info('Screenshot saved. Exiting (screenshot-only mode).');
    await context.close();
    process.exit(0);
  }

  // Full collection mode
  const existing = readJSON(config.FILES.ids, []);
  const existingIdSet = new Set(existing.map((e) => e.id));
  log.info(`Previously collected IDs: ${existing.length}`);

  const total = await getTotalInfo(page);
  if (total !== null) {
    log.info(`Total records on search page: ${total}`);
  }

  let allMatches = [...existing];
  let pageNum = 1;

  while (true) {
    log.info(`Parsing page ${pageNum}...`);
    const matches = await parseSearchPage(page);

    if (matches === null) {
      log.error('Stopping due to missing table structure.');
      break;
    }

    for (const m of matches) {
      if (!existingIdSet.has(m.id)) {
        allMatches.push(m);
        existingIdSet.add(m.id);
      }
    }

    writeJSON(config.FILES.ids, allMatches);

    const hasNext = await goNextPage(page);
    if (!hasNext) {
      log.info('Reached last page.');
      break;
    }
    pageNum++;
  }

  writeJSON(config.FILES.ids, allMatches);
  log.info(`Total matching announcements: ${allMatches.length}`);
  log.info(`Saved to ${config.FILES.ids}`);

  await context.close();
}

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
