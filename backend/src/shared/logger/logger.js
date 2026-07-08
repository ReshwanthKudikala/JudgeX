// Structured JSON logger with a child-logger factory for request/job context.
// Framework-agnostic: it does not read env directly; call configure() at boot.

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
]);

let currentLevel = 'info';

function configure({ level } = {}) {
  if (level && Object.prototype.hasOwnProperty.call(LEVELS, level)) {
    currentLevel = level;
  }
}

function redact(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return out;
}

function write(level, bindings, message, meta) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...bindings,
    ...(meta ? redact(meta) : {}),
  };
  const line = `${JSON.stringify(entry)}\n`;
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

// Default root logger; child loggers carry per-request/job context.
const logger = createLogger();

module.exports = { logger, createLogger, configure };
