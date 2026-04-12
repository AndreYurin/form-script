/**
 * Step 1 — Collect announcement IDs from the search page.
 *
 * Opens the filtered search results on goszakup.gov.kz, iterates through
 * every page of results, and for each row checks whether the "Организатор"
 * field contains any of the target keywords (школ, образовательн, ясл,
 * гимнази, лице).  Matching announcement numbers are saved to
 * data/matched_ids.json.
 *
 * Site structure (search results page):
 *   - Table with class "table" or DataTables wrapper
 *   - Each row: <tr> inside <tbody>
 *   - Columns: №, Наименование (with Организатор below), Способ, Даты, Сумма, Статус
 *   - Pagination: links inside .pagination or DataTables controls
 *   - "Показано c X по Y из Z записей" — total record indicator
 */

const config = require('./config');
const { launchBrowser } = require('./lib/browser');
const { readJSON, writeJSON } = require('./lib/files');
const log = require('./lib/logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a single page of search results.
 * Returns an array of { id, number, organizer } for rows matching keywords.
 */
async function parseSearchPage(page) {
  // The search results table has id="search-result" and uses DataTables.
  // Structure per row:
  //   td[0]: <strong>16776705-1</strong> (number) + lot count
  //   td[1]: <a href="/ru/announce/index/...">Title</a>
  //          <small><b>Организатор:</b> Name</small>
  //   td[2]: Procurement method
  //   td[3]: Start date
  //   td[4]: End date
  //   td[5]: <strong>Amount</strong>
  //   td[6]: Status
  const tableSelector = '#search-result tbody tr';
  try {
    await page.waitForSelector(tableSelector, { timeout: config.PAGE_LOAD_TIMEOUT });
  } catch {
    log.error(
      'Cannot find results table on the page. The site structure may have changed.\n' +
      'Expected selector: ' + tableSelector
    );
    return null; // signal to stop
  }

  const rows = await page.$$(tableSelector);
  if (rows.length === 0) {
    log.warn('Table found but contains zero rows.');
    return [];
  }

  const matches = [];

  for (const row of rows) {
    // Extract organizer from the <small> inside the second <td>
    const orgEl = await row.$('td:nth-child(2) small');
    const orgText = orgEl ? await orgEl.innerText().catch(() => '') : '';
    const organizer = orgText.replace(/^Организатор:\s*/i, '').trim();

    if (!organizer) continue;

    // Check keywords against organizer
    const lowerOrg = organizer.toLowerCase();
    const hit = config.KEYWORDS.some((kw) => lowerOrg.includes(kw.toLowerCase()));

    if (!hit) continue;

    // Extract announcement number from first <td> > <strong>
    const numEl = await row.$('td:first-child strong');
    const numText = numEl ? (await numEl.innerText()).trim() : '';
    const numberMatch = numText.match(/(\d[\d-]+)/);
    if (!numberMatch) {
      log.warn(`Matched organizer "${organizer}" but could not extract number from: "${numText}"`);
      continue;
    }

    const fullNumber = numberMatch[1]; // e.g. "16776705-1"

    matches.push({
      number: fullNumber,
      id: fullNumber.split('-')[0], // e.g. "16776705"
      organizer,
    });

    log.ok(`Match: ${fullNumber} — ${organizer.substring(0, 80)}`);
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
 *
 * Server-side pagination uses <ul class="pagination"> with:
 *   - «  (previous) — href="javascript:void(0)" when disabled, real URL otherwise
 *   - page numbers — <li class="active"> for current page
 *   - »  (next) — href="javascript:void(0)" when on last page, real URL otherwise
 */
async function goNextPage(page) {
  // The » link is inside the last <li> of .pagination
  const nextLink = page.locator('.pagination li:last-child a');
  if ((await nextLink.count()) === 0) return false;

  const href = await nextLink.getAttribute('href').catch(() => '');
  // If href is void or empty, we're on the last page
  if (!href || href.includes('javascript:void')) return false;

  await nextLink.click();
  await page.waitForLoadState('domcontentloaded', { timeout: config.PAGE_LOAD_TIMEOUT });
  await sleep(config.NAV_DELAY);
  return true;
}

async function main() {
  log.info('=== Step 1: Collecting announcement IDs ===');

  // Load any previously collected IDs (to append, not overwrite)
  const existing = readJSON(config.FILES.ids, []);
  const existingIdSet = new Set(existing.map((e) => e.id));
  log.info(`Previously collected IDs: ${existing.length}`);

  const context = await launchBrowser();
  const page = await context.newPage();

  log.info('Opening search page...');
  try {
    await page.goto(config.SEARCH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: config.PAGE_LOAD_TIMEOUT,
    });
  } catch (err) {
    log.error(`Failed to load search page: ${err.message}`);
    log.error('Check your internet connection or the site may be down.');
    await context.close();
    process.exit(1);
  }

  await sleep(3000); // let DataTables fully initialize

  const total = await getTotalInfo(page);
  if (total !== null) {
    log.info(`Total records found: ${total}`);
  }

  let allMatches = [...existing];
  let pageNum = 1;

  while (true) {
    log.info(`Parsing page ${pageNum}...`);
    const matches = await parseSearchPage(page);

    if (matches === null) {
      // Critical error — table not found
      log.error('Stopping due to missing table structure.');
      break;
    }

    for (const m of matches) {
      if (!existingIdSet.has(m.id)) {
        allMatches.push(m);
        existingIdSet.add(m.id);
      }
    }

    // Save after each page (crash recovery)
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
