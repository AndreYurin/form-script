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

async function launchBrowser() {
  const userDataDir = config.USE_SYSTEM_CHROME
    ? config.CHROME_USER_DATA
    : path.resolve(__dirname, '..', 'data', 'browser-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: config.HEADLESS,
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
