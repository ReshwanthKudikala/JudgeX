// Judge worker heartbeat in Redis — used by readiness / admin monitoring.
// TTL-based: if the worker stops beating, health reports unhealthy.

const { getRedis } = require('../cache/redis.cache');

const HEARTBEAT_KEY = 'judgex:obs:worker:judge:heartbeat';
const HEARTBEAT_TTL_MS = 30_000;

/**
 * @param {{ uptime?: number, pid?: number, concurrency?: number }} [payload]
 */
async function writeWorkerHeartbeat(payload = {}) {
  const redis = getRedis();
  const body = JSON.stringify({
    at: new Date().toISOString(),
    epochMs: Date.now(),
    uptime: payload.uptime ?? process.uptime(),
    pid: payload.pid ?? process.pid,
    concurrency: payload.concurrency ?? null,
  });
  await redis.set(HEARTBEAT_KEY, body, 'PX', HEARTBEAT_TTL_MS);
}

/**
 * @returns {Promise<{ ok: boolean, lastSeenAt?: string, uptime?: number, ageMs?: number, error?: string }>}
 */
async function getWorkerHeartbeat() {
  try {
    const redis = getRedis();
    const raw = await redis.get(HEARTBEAT_KEY);
    if (!raw) {
      return { ok: false, error: 'no_heartbeat' };
    }
    const parsed = JSON.parse(raw);
    const ageMs = Date.now() - Number(parsed.epochMs || 0);
    const ok = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < HEARTBEAT_TTL_MS;
    return {
      ok,
      lastSeenAt: parsed.at,
      uptime: parsed.uptime,
      pid: parsed.pid,
      concurrency: parsed.concurrency,
      ageMs,
      ...(ok ? {} : { error: 'stale_heartbeat' }),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

module.exports = {
  writeWorkerHeartbeat,
  getWorkerHeartbeat,
  HEARTBEAT_KEY,
  HEARTBEAT_TTL_MS,
};
