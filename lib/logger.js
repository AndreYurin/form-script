/**
 * Simple console logger with timestamps and colour coding.
 */

function ts() {
  return new Date().toLocaleTimeString('ru-RU');
}

const log = {
  info: (msg) => console.log(`[${ts()}] INFO  ${msg}`),
  warn: (msg) => console.warn(`[${ts()}] \x1b[33mWARN\x1b[0m  ${msg}`),
  error: (msg) => console.error(`[${ts()}] \x1b[31mERROR\x1b[0m ${msg}`),
  ok: (msg) => console.log(`[${ts()}] \x1b[32mOK\x1b[0m    ${msg}`),
};

module.exports = log;
