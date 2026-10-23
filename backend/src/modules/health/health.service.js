// Health / readiness probes for orchestrators (PRD NFR-OBS-3).
// Liveness = process is up. Readiness = Postgres + Redis + BullMQ can serve traffic.
// A missing worker heartbeat, or a worker that cannot reach Docker, sets
// degraded without clearing ready. The API process does not ping Docker.

const { getBuildInfo } = require('../../shared/build-info');
const {
  checkPostgresHealth,
  checkRedisHealth,
} = require('../../infrastructure');
const { getSubmissionsQueue, SUBMISSIONS_QUEUE_NAME } = require('../../infrastructure/queue/queues');
const { getWorkerHeartbeat } = require('../../infrastructure/queue/worker-heartbeat');
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
 * Docker status for readiness. Only an explicit worker probe counts.
 * No heartbeat, or a heartbeat from a worker that did not probe Docker,
 * is "not reported" — that is not treated as a Docker failure.
 *
 * @param {{ docker?: { ok?: boolean, error?: string } } | null | undefined} worker
 */
function sandboxDockerCheck(worker) {
  if (worker && worker.docker && typeof worker.docker.ok === 'boolean') {
    return worker.docker.error
      ? { ok: worker.docker.ok, error: worker.docker.error }
      : { ok: worker.docker.ok };
  }
  return { ok: false, reported: false, error: 'not_reported' };
}

/**
 * Core data plane is up, but judging cannot run: the worker is absent, or
 * the worker reports that its Docker daemon is unreachable.
 *
 * @param {boolean} ready
 * @param {{ ok?: boolean, docker?: { ok?: boolean } } | null | undefined} worker
 */
function isDegraded(ready, worker) {
  if (!ready) return false;
  if (!worker || worker.ok !== true) return true;
  return Boolean(worker.docker && worker.docker.ok === false);
}

/**
 * Full readiness diagnostics: Postgres, Redis, BullMQ + worker heartbeat.
 * Docker in this payload is the worker's probe, not a ping from the API.
 * @returns {Promise<object>}
 */
async function getReadiness() {
  const [postgres, redis, bullmq, worker] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkBullmqHealth(),
    getWorkerHeartbeat(),
  ]);

  const docker = sandboxDockerCheck(worker);
  const checks = { postgres, redis, bullmq, worker, docker };
  // API can accept traffic when the core data plane is up.
  const ready = Boolean(postgres.ok && redis.ok && bullmq.ok);
  const degraded = isDegraded(ready, worker);

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
  sandboxDockerCheck,
  isDegraded,
};
