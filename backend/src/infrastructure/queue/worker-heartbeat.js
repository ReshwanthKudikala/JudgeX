// Judge worker heartbeat in Redis — used by readiness / admin monitoring.
// TTL-based: if the worker stops beating, health reports unhealthy.

const { getRedis } = require('../cache/redis.cache');

const HEARTBEAT_KEY = 'judgex:obs:worker:judge:heartbeat';
const HEARTBEAT_TTL_MS = 30_000;

/**
 * Heartbeat body. Docker is included only when the worker probed it.
 * The API does not invent a Docker result for an older heartbeat.
 *
 * @param {{ uptime?: number, pid?: number, concurrency?: number, docker?: { ok?: boolean, error?: string } }} [payload]
 */
function buildHeartbeatRecord(payload = {}) {
  const record = {
    at: new Date().toISOString(),
    epochMs: Date.now(),
    uptime: payload.uptime ?? process.uptime(),
    pid: payload.pid ?? process.pid,
    concurrency: payload.concurrency ?? null,
  };
  if (payload.docker && typeof payload.docker.ok === 'boolean') {
    record.docker = { ok: payload.docker.ok };
    if (payload.docker.error) record.docker.error = String(payload.docker.error);
  }
  return record;
}

/**
 * @param {object | null | undefined} parsed
 * @returns {{ ok: boolean, error?: string } | undefined}
 */
function dockerFromHeartbeat(parsed) {
  if (!parsed || !parsed.docker || typeof parsed.docker.ok !== 'boolean') return undefined;
  const docker = { ok: parsed.docker.ok };
  if (parsed.docker.error) docker.error = String(parsed.docker.error);
  return docker;
}

/**
 * @param {{ uptime?: number, pid?: number, concurrency?: number, docker?: { ok?: boolean, error?: string } }} [payload]
 */
async function writeWorkerHeartbeat(payload = {}) {
  const redis = getRedis();
  const body = JSON.stringify(buildHeartbeatRecord(payload));
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
    const docker = dockerFromHeartbeat(parsed);
    return {
      ok,
      lastSeenAt: parsed.at,
      uptime: parsed.uptime,
      pid: parsed.pid,
      concurrency: parsed.concurrency,
      ageMs,
      ...(docker ? { docker } : {}),
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
  buildHeartbeatRecord,
  dockerFromHeartbeat,
  writeWorkerHeartbeat,
  getWorkerHeartbeat,
  HEARTBEAT_KEY,
  HEARTBEAT_TTL_MS,
};
