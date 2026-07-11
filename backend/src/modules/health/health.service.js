// Health / readiness probes for orchestrators (PRD NFR-OBS-3).
// Liveness = process is up. Readiness = Postgres + Redis + BullMQ can serve traffic.
// Extended checks (worker heartbeat, Docker) are reported without failing API readiness
// when the API host does not run the judge worker / Docker daemon.

const { getBuildInfo } = require('../../shared/build-info');
const {
  checkPostgresHealth,
  checkRedisHealth,
} = require('../../infrastructure');
const { getSubmissionsQueue, SUBMISSIONS_QUEUE_NAME } = require('../../infrastructure/queue/queues');
const { getWorkerHeartbeat } = require('../../infrastructure/queue/worker-heartbeat');
const { checkDockerHealth } = require('../../infrastructure/docker/docker.adapter');
const { getLastReaperSweep } = require('../reaper/reaper.service');
const { metrics } = require('../../shared/observability/metrics');

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
    metrics.setQueueDepth(counts);
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
  const build = getBuildInfo();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: build.version,
    build: {
      gitSha: build.gitSha,
      buildTime: build.buildTime,
      node: build.node,
    },
  };
}

/**
 * Full readiness diagnostics: Postgres, Redis, BullMQ + worker/Docker/reaper.
 * @returns {Promise<object>}
 */
async function getReadiness() {
  const [postgres, redis, bullmq, worker, docker] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkBullmqHealth(),
    getWorkerHeartbeat(),
    checkDockerHealth(),
  ]);

  const checks = { postgres, redis, bullmq, worker, docker };
  // API can accept traffic when core data plane is up. Worker/Docker are
  // reported for operators; they may live on a separate host.
  const ready = Boolean(postgres.ok && redis.ok && bullmq.ok);
  const degraded = ready && (!worker.ok || !docker.ok);

  const build = getBuildInfo();
  return {
    ready,
    degraded,
    // Keep legacy status values (ready | not_ready) for orchestrators.
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: build.version,
    build: {
      gitSha: build.gitSha,
      buildTime: build.buildTime,
      node: build.node,
    },
    checks,
    diagnostics: {
      queue: bullmq.ok
        ? { name: bullmq.queue, counts: bullmq.counts }
        : { name: SUBMISSIONS_QUEUE_NAME, error: bullmq.error },
      reaper: getLastReaperSweep(),
      worker,
      degraded,
    },
  };
}

module.exports = {
  getLiveness,
  getReadiness,
  checkBullmqHealth,
};
