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
 *   - "Статус" checkboxes (210, 220, 240): input[name="filter[status][]"][value="210|220|240"]
 *   - Submit button: button[type="submit"] or button.smb inside the filter form
 *   - Results table: #search-result tbody tr
 */

const config = require('./config');
const { launchBrowser } = require('./lib/browser');
const { readJSON, writeJSON } = require('./lib/files');
const log = require('./lib/logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  // Select statuses in the multi-select: 210 Опубликовано, 220 прием заявок, 240 прием ценовых предложений
  await page.selectOption('select[name="filter[status][]"]', ['210', '220', '240']);
  log.info('Selected statuses: 210, 220, 240');

  log.info('Clicking search button...');
  const submitBtn = page.locator('button[type="submit"]:has-text("Найти")');
  await submitBtn.click();

  // Wait for results table
  await page.waitForSelector('#search-result tbody tr', {
    timeout: config.PAGE_LOAD_TIMEOUT,
  });

  await sleep(config.NAV_DELAY);
  log.info('Search results loaded.');
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
  const ORGANIZER_FILTER = /школа|образовательн|ясл|гимназ|лице/i;

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

    if (!ORGANIZER_FILTER.test(organizer)) {
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

  log.info(`=== Step 1: Collecting announcement IDs (keyword: "${keyword}") ===`);

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
