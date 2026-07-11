// Background worker: periodic housekeeping, including the stuck-queued
// submission reaper (persist-before-enqueue safety net).
//
// Runs as its own process: `node src/workers/cleanup.worker.js`.
// Sprint 16 scope: ONLY the queued-submission reaper. Orphan-container /
// dead-job handling remains for later cleanup passes.

const { config } = require('../config');
const { configure: configureLogger, createLogger } = require('../shared/logger/logger');
const { initInfrastructure, shutdownInfrastructure } = require('../infrastructure');
const { startReaperScheduler } = require('../modules/reaper/reaper.scheduler');

const log = createLogger({ component: 'cleanup-worker' });

let scheduler = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Cleanup worker shutdown initiated', { signal });

  const forceTimer = setTimeout(() => {
    log.error('Cleanup worker graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (scheduler) {
      await scheduler.stop();
      scheduler = null;
    }
    await shutdownInfrastructure();
    clearTimeout(forceTimer);
    log.info('Cleanup worker shutdown complete');
    process.exit(0);
  } catch (err) {
    log.error('Error during cleanup worker shutdown', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

async function start() {
  configureLogger({ level: config.logging.level });

  try {
    await initInfrastructure();
  } catch (err) {
    log.error('Infrastructure initialization failed; cleanup worker aborting', {
      error: err.message,
    });
    await shutdownInfrastructure();
    process.exit(1);
  }

  scheduler = startReaperScheduler();
  log.info('Cleanup worker started', {
    reaperIntervalMs: config.reaper.intervalMs,
    stuckThresholdMs: config.reaper.stuckThresholdMs,
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
    shutdown('unhandledRejection');
  });
}

if (require.main === module) {
  start();
}

module.exports = { start };
