// Periodic scheduler for the stuck-queued submission reaper.
// Runs inside the cleanup worker process (BACKEND_STRUCTURE.md §6.2–6.3).

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { reaperService } = require('./reaper.service');

/**
 * Start a periodic reaper loop.
 *
 * @param {object} [options]
 * @param {import('./reaper.service').ReaperService} [options.service]
 * @param {number} [options.intervalMs]
 * @returns {{ stop: () => Promise<void> }}
 */
function startReaperScheduler(options = {}) {
  const service = options.service || reaperService;
  const intervalMs = options.intervalMs ?? config.reaper.intervalMs;

  let timer = null;
  let stopped = false;
  let inFlight = null;

  async function tick() {
    if (stopped) return;
    if (inFlight) return; // skip overlapping ticks
    inFlight = service
      .sweep()
      .catch((err) => {
        logger.warn('Reaper sweep failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }

  logger.info('Queued-submission reaper scheduler started', { intervalMs });
  // Run once shortly after boot, then on the interval.
  timer = setInterval(() => {
    tick();
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  // Kick off an initial pass without blocking the caller.
  setTimeout(() => {
    tick();
  }, 0).unref?.();

  return {
    async stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (inFlight) {
        try {
          await inFlight;
        } catch {
          /* ignore */
        }
      }
      logger.info('Queued-submission reaper scheduler stopped');
    },
  };
}

module.exports = { startReaperScheduler };
