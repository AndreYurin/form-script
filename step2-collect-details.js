/**
 * Step 2 — Collect details for each matched announcement.
 *
 * Reads data/matched_ids.json (output of step 1), then for each ID that
 * hasn't been processed yet, opens the announcement page and extracts:
 *   1) Наименование организатора
 *   2) Сумма
 *   3) Дата завершения (срок окончания приёма заявок)
 *   4) Номер объявления
 *   5) Ссылка на объявление
 *
 * Results are appended to data/results.json.
 * Processed IDs are tracked in data/progress.json for crash recovery.
 *
 * Announcement detail page structure:
 *   - URL: /ru/announce/index/{id}
 *   - "Общие сведения" (General info) tab is shown by default
 *   - Key-value pairs are laid out as <dt>/<dd> or label/value table rows
 *   - "Организатор" — organizer name
 *   - "Сумма" — total amount
 *   - "Срок окончания приема заявок" — application deadline
 *   - Announcement number appears in the heading or breadcrumb
 */

const config = require('./config');
const { launchBrowser } = require('./lib/browser');
const { readJSON, writeJSON } = require('./lib/files');
const log = require('./lib/logger');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract announcement details from the detail page.
 * Returns an object with the five required fields or null on failure.
 */
async function extractDetails(page, id) {
  const url = config.ANNOUNCE_BASE_URL.replace('{id}', id);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: config.PAGE_LOAD_TIMEOUT,
    });
  } catch (err) {
    log.error(`Failed to load ${url}: ${err.message}`);
    return null;
  }

  await sleep(2000); // let page render

  // Verify we're on a valid announcement page
  const pageContent = await page.content();
  if (pageContent.includes('Ошибка') && pageContent.includes('404')) {
    log.warn(`Announcement ${id} returned 404.`);
    return null;
  }

  // The detail page uses <th>Label</th><td>Value</td> rows for key-value data.
  // Build a map of all th/td pairs for reliable extraction.
  const fieldMap = await page.evaluate(() => {
    const map = {};
    document.querySelectorAll('tr').forEach((tr) => {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (th && td) {
        map[th.textContent.trim()] = td.textContent.trim();
      }
    });
    return map;
  });

  // 1) Организатор — field "Организатор", value has BIN prefix like "020940001182 Name..."
  let organizer = fieldMap['Организатор'] || '';
  // Strip leading BIN number (12-digit numeric prefix)
  organizer = organizer.replace(/^\d{12}\s*/, '');

  // 2) Сумма — field "Сумма закупки"
  const amount = fieldMap['Сумма закупки'] || fieldMap['Сумма'] || '';

  // 3) Дата завершения — stored as a readonly <input> value inside a form-group
  //    with label "Срок окончания приема заявок".
  //    Format: "2026-04-30 22:46:10"
  let endDate = await page.evaluate(() => {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.includes('Срок окончания приема заявок')) {
        const container = label.closest('.form-group');
        if (container) {
          const input = container.querySelector('input');
          if (input) return input.value;
        }
      }
    }
    return '';
  });

  // 4) Номер объявления — from step 1 data or URL
  const number = id;

  // 5) URL
  const currentUrl = page.url();

  // Warn if key fields are missing
  if (!organizer) log.warn(`[${id}] Could not extract organizer name.`);
  if (!amount) log.warn(`[${id}] Could not extract amount.`);
  if (!endDate) log.warn(`[${id}] Could not extract end date.`);

  return {
    id,
    number,
    organizer: cleanText(organizer),
    amount: cleanText(amount),
    endDate: cleanText(endDate),
    url: currentUrl,
  };
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

async function main() {
  log.info('=== Step 2: Collecting announcement details ===');

  const ids = readJSON(config.FILES.ids, []);
  if (ids.length === 0) {
    log.error('No announcement IDs found. Run step 1 first (node step1-collect-ids.js).');
    process.exit(1);
  }
  log.info(`Total announcements to process: ${ids.length}`);

  // Load progress
  const progress = new Set(readJSON(config.FILES.progress, []));
  const results = readJSON(config.FILES.results, []);

  const targetId = process.env.NOTICE_ID;
  let pending;
  if (targetId) {
    pending = ids.filter((item) => String(item.id) === String(targetId));
    if (pending.length === 0) {
      pending = [{ id: targetId, number: targetId, organizer: '' }];
    }
    log.info(`NOTICE_ID=${targetId} — processing single announcement.`);
  } else {
    pending = ids.filter((item) => !progress.has(item.id));
  }
  log.info(`Already processed: ${progress.size}, remaining: ${pending.length}`);

  if (pending.length === 0) {
    log.ok('All announcements have been processed. Nothing to do.');
    process.exit(0);
  }

  const context = await launchBrowser();
  const page = await context.newPage();

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    log.info(`[${i + 1}/${pending.length}] Processing announcement ${item.id}...`);

    const details = await extractDetails(page, item.id);

    if (details) {
      results.push(details);
      log.ok(
        `${item.id}: ${details.organizer.substring(0, 60)} | ${details.amount} | ${details.endDate}`
      );
    } else {
      // Save a placeholder so we know it was attempted but failed
      results.push({
        id: item.id,
        number: item.number,
        organizer: item.organizer || '',
        amount: 'ОШИБКА: не удалось получить',
        endDate: '',
        url: config.ANNOUNCE_BASE_URL.replace('{id}', item.id),
        error: true,
      });
      log.warn(`${item.id}: Failed to extract details — marked with error.`);
    }

    // Mark as processed
    progress.add(item.id);

    // Persist after every item (crash recovery)
    writeJSON(config.FILES.results, results);
    writeJSON(config.FILES.progress, [...progress]);

    // Polite delay
    if (i < pending.length - 1) {
      await sleep(config.NAV_DELAY);
    }
  }

  log.info(`\nDone! Results saved to ${config.FILES.results}`);
  log.info(`Total results: ${results.length}`);

  await context.close();
}

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
