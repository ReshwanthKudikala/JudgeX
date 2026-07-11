// Structured logger with JSON (production) and pretty (development) formats.
// Framework-agnostic: call configure() at boot. Never log secrets.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const REDACT_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'jwt',
  'authorization',
  'apikey',
  'openai_api_key',
  'sourcecode',
  'source_code',
]);

let currentLevel = 'info';
/** @type {'json'|'pretty'} */
let currentFormat = 'json';

/**
 * @param {{ level?: string, format?: 'json'|'pretty' }} [opts]
 */
function configure({ level, format } = {}) {
  if (level && Object.prototype.hasOwnProperty.call(LEVELS, level)) {
    currentLevel = level;
  }
  if (format === 'json' || format === 'pretty') {
    currentFormat = format;
  }
}

function redactValue(key, value) {
  if (REDACT_KEYS.has(String(key).toLowerCase())) return '[REDACTED]';
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
    return redact(value);
  }
  return value;
}

function redact(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

function formatPretty(entry) {
  const { timestamp, level, message, ...rest } = entry;
  const extras = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} ${String(level).toUpperCase().padEnd(5)} ${message}${extras}\n`;
}

function write(level, bindings, message, meta) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(bindings),
    ...(meta ? redact(meta) : {}),
  };
  const line = currentFormat === 'pretty' ? formatPretty(entry) : `${JSON.stringify(entry)}\n`;
  if (level === 'error' || level === 'warn') process.stderr.write(line);
  else process.stdout.write(line);
}

function createLogger(bindings = {}) {
  return {
    error: (message, meta) => write('error', bindings, message, meta),
    warn: (message, meta) => write('warn', bindings, message, meta),
    info: (message, meta) => write('info', bindings, message, meta),
    debug: (message, meta) => write('debug', bindings, message, meta),
    child: (extra = {}) => createLogger({ ...bindings, ...extra }),
  };
}

const logger = createLogger();

module.exports = { logger, createLogger, configure, redact };
