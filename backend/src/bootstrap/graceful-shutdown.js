// Drains connections and queues on SIGTERM/SIGINT; force-exits if it hangs.

const { logger } = require('../shared/logger/logger');

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Registers process signal + fatal-error handlers for a clean shutdown.
 *
 * @param {import('http').Server} server - the running HTTP server to close.
 * @param {object} [options]
 * @param {Array<() => Promise<void>>} [options.onShutdown] - extra async
 *        cleanup callbacks (e.g. DB pool/queue close) run after the server stops
 *        accepting connections. None are registered during bootstrap.
 * @param {number} [options.timeoutMs] - hard deadline before forced exit.
 */
function registerGracefulShutdown(server, { onShutdown = [], timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown initiated', { signal });

    // Force-exit if graceful drain exceeds the deadline.
    const forceTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceTimer.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');

      for (const task of onShutdown) {
        // eslint-disable-next-line no-await-in-loop -- run cleanups sequentially.
        await task();
      }

      clearTimeout(forceTimer);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { message: err.message, stack: err.stack });
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Last-resort safety nets: log and shut down rather than crashing silently.
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    shutdown('unhandledRejection');
  });
}

module.exports = { registerGracefulShutdown };
