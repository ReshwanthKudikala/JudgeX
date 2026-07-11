// Health / readiness probes for orchestrators (PRD NFR-OBS-3).
// Liveness = process is up. Readiness = Postgres + Redis + BullMQ can serve traffic.

const pkg = require('../../../package.json');
const {
  checkPostgresHealth,
  checkRedisHealth,
} = require('../../infrastructure');
const { getSubmissionsQueue, SUBMISSIONS_QUEUE_NAME } = require('../../infrastructure/queue/queues');
const { getLastReaperSweep } = require('../reaper/reaper.service');

/**
 * BullMQ / queue probe + counts (NFR-OBS-2).
 * @returns {Promise<{ ok: boolean, queue?: string, counts?: object, latencyMs?: number, error?: string }>}
 */
async function checkBullmqHealth() {
  const start = Date.now();
  try {
    const queue = getSubmissionsQueue();
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    return {
      ok: true,
      queue: SUBMISSIONS_QUEUE_NAME,
      counts,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      queue: SUBMISSIONS_QUEUE_NAME,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Liveness payload — no dependency checks (process is alive).
 */
function getLiveness() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: pkg.version,
  };
}

/**
 * Full readiness diagnostics: Postgres, Redis, BullMQ + queue/reaper stats.
 * @returns {Promise<{ ready: boolean, status: string, checks: object, diagnostics: object }>}
 */
async function getReadiness() {
  const [postgres, redis, bullmq] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkBullmqHealth(),
  ]);

  const checks = { postgres, redis, bullmq };
  const ready = Boolean(postgres.ok && redis.ok && bullmq.ok);

  return {
    ready,
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: pkg.version,
    checks,
    diagnostics: {
      queue: bullmq.ok
        ? { name: bullmq.queue, counts: bullmq.counts }
        : { name: SUBMISSIONS_QUEUE_NAME, error: bullmq.error },
      reaper: getLastReaperSweep(),
    },
  };
}

module.exports = {
  getLiveness,
  getReadiness,
  checkBullmqHealth,
};
