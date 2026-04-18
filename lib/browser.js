/**
 * Browser launcher.
 *
 * Two modes:
 * 1. USE_SYSTEM_CHROME = true  — launches Chromium with the user's Chrome
 *    profile directory so cookies/sessions are preserved.  Chrome must be
 *    fully closed before running the script.
 * 2. USE_SYSTEM_CHROME = false — launches Playwright's bundled Chromium
 *    with a local persistent context stored in ./data/browser-profile.
 *    The session persists between runs (cookies saved automatically).
 */

const { chromium } = require('playwright');
const path = require('path');
const config = require('../config');

// `opts.headless`, when set, overrides the global `config.HEADLESS`.
// Step 1 / Step 2 CLI scripts pass `{ headless: true }` by default so unattended
// runs don't pop a visible Chromium window. The headed auth flow keeps using
// `config.HEADLESS = false` so the operator can log in by hand.
async function launchBrowser(opts = {}) {
  const userDataDir = config.USE_SYSTEM_CHROME
    ? config.CHROME_USER_DATA
    : path.resolve(__dirname, '..', 'data', 'browser-profile');

  const headless = typeof opts.headless === 'boolean' ? opts.headless : config.HEADLESS;

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
  });

  return context;
}

module.exports = { launchBrowser };
