/**
 * Main entry point — runs both scraping steps sequentially.
 *
 * Usage:
 *   node index.js          — run both steps
 *   node index.js --step1  — collect IDs only
 *   node index.js --step2  — collect details only (IDs must exist)
 *   node index.js --reset  — clear all data and start fresh
 *
 * Environment variables:
 *   USE_SYSTEM_CHROME=1  — use your real Chrome profile (Chrome must be closed)
 *   HEADLESS=1           — run without visible browser window
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const log = require('./lib/logger');

const args = process.argv.slice(2);

// Apply env overrides
if (process.env.USE_SYSTEM_CHROME === '1') {
  config.USE_SYSTEM_CHROME = true;
}
if (process.env.HEADLESS === '1') {
  config.HEADLESS = true;
}

function run(script) {
  log.info(`Running ${script}...`);
  execFileSync('node', [path.join(__dirname, script)], {
    stdio: 'inherit',
    env: { ...process.env },
  });
}

if (args.includes('--reset')) {
  log.warn('Resetting all data...');
  for (const f of Object.values(config.FILES)) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      log.info(`Deleted ${f}`);
    }
  }
  log.ok('Reset complete.');
  process.exit(0);
}

if (args.includes('--step1')) {
  run('step1-collect-ids.js');
} else if (args.includes('--step2')) {
  run('step2-collect-details.js');
} else {
  // Run both
  run('step1-collect-ids.js');
  run('step2-collect-details.js');
}
