/** Structured logger for backend */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = process.env.LOG_LEVEL ? LEVELS[process.env.LOG_LEVEL] : LEVELS.info;

function log(level, tag, message, meta) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const ts = new Date().toISOString();
  const prefix = `${ts} [${level.toUpperCase()}] [${tag}]`;
  if (meta !== undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](prefix, message, meta);
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](prefix, message);
  }
}

const logger = {
  debug: (tag, msg, meta) => log('debug', tag, msg, meta),
  info:  (tag, msg, meta) => log('info',  tag, msg, meta),
  warn:  (tag, msg, meta) => log('warn',  tag, msg, meta),
  error: (tag, msg, meta) => log('error', tag, msg, meta),
};

module.exports = { logger };
