/**
 * Configuration for goszakup.gov.kz scraper.
 *
 * SEARCH_URL        - Pre-filtered search page URL (keyword "программ", statuses 210/220/240).
 * ANNOUNCE_BASE_URL - Template for individual announcement pages ({id} is replaced at runtime).
 * KEYWORDS          - Substrings checked against the "Организатор" field (case-insensitive).
 * USE_SYSTEM_CHROME - When true, connects to the user's Chrome profile so existing
 *                     cookies/sessions are reused (requires Chrome to be closed first).
 * CHROME_USER_DATA  - Path to Chrome's user-data directory (macOS default shown).
 * HEADLESS          - Run browser without a visible window. Set false to watch the process.
 * PAGE_LOAD_TIMEOUT - Max time (ms) to wait for a page to load.
 * NAV_DELAY         - Polite delay (ms) between page navigations to avoid rate-limiting.
 * FILES.ids         - Stores matched announcement IDs (step 1 output).
 * FILES.results     - Stores collected announcement details (step 2 output).
 * FILES.progress    - Tracks which IDs have been processed (crash-recovery).
 */

module.exports = {
  SEARCH_URL:
    'https://goszakup.gov.kz/ru/search/announce?filter%5Bname%5D=%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC&filter%5Bcustomer%5D=&filter%5Bnumber%5D=&filter%5Byear%5D=&filter%5Bstatus%5D%5B%5D=210&filter%5Bstatus%5D%5B%5D=220&filter%5Bstatus%5D%5B%5D=240&filter%5Bamount_from%5D=&filter%5Bamount_to%5D=&filter%5Btrade_type%5D=&filter%5Btype%5D=&filter%5Bstart_date_from%5D=&filter%5Bstart_date_to%5D=&filter%5Bend_date_from%5D=&filter%5Bend_date_to%5D=&filter%5Bitog_date_from%5D=&filter%5Bitog_date_to%5D=&smb=',

  ANNOUNCE_BASE_URL: 'https://goszakup.gov.kz/ru/announce/index/{id}',

  KEYWORDS: ['школ', 'образовательн', 'ясл', 'гимнази', 'лице'],

  USE_SYSTEM_CHROME: false,
  CHROME_USER_DATA:
    process.env.CHROME_USER_DATA ||
    `${process.env.HOME}/Library/Application Support/Google/Chrome`,

  HEADLESS: false,
  PAGE_LOAD_TIMEOUT: 30_000,
  NAV_DELAY: 2_000,

  FILES: {
    ids: 'data/matched_ids.json',
    results: 'data/results.json',
    progress: 'data/progress.json',
  },
};
