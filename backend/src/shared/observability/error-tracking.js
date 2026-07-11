// Centralized error tracking — log stack traces and bump error metrics.
// Does not replace AppError operational handling; used for unexpected failures.

const { logger } = require('../logger/logger');
const { metrics } = require('./metrics');

/**
 * @param {string} source
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 * @param {{ log?: import('../logger/logger').logger }} [opts]
 */
function trackError(source, err, extra = {}, opts = {}) {
  const log = opts.log || logger;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  metrics.recordError(source);
  log.error(`tracked_error:${source}`, {
    source,
    error: message,
    stack,
    ...extra,
  });
}

/**
 * Register process-level handlers (uncaughtException / unhandledRejection).
 * @param {{ onFatal?: (signal: string) => void, component?: string }} [opts]
 */
function registerProcessErrorHandlers({ onFatal, component = 'process' } = {}) {
  process.on('uncaughtException', (err) => {
    trackError(`${component}.uncaughtException`, err);
    if (typeof onFatal === 'function') onFatal('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    trackError(
      `${component}.unhandledRejection`,
      reason instanceof Error ? reason : new Error(String(reason)),
    );
    if (typeof onFatal === 'function') onFatal('unhandledRejection');
  });
}

module.exports = { trackError, registerProcessErrorHandlers };
