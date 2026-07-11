// Shared Redis JSON cache helpers with Prometheus hit/miss counters.
// Failures never break callers — cache is best-effort.

const { getRedis } = require('../cache/redis.cache');
const { logger } = require('../../shared/logger/logger');
const { metrics } = require('../../shared/observability/metrics');

/**
 * @param {string} namespace - metric label (e.g. leaderboard, problem, contest, editorial)
 * @param {string} key
 * @returns {Promise<unknown|null>}
 */
async function cacheGet(namespace, key) {
  try {
    const raw = await getRedis().get(key);
    if (!raw) {
      metrics.recordCacheAccess(namespace, 'miss');
      return null;
    }
    metrics.recordCacheAccess(namespace, 'hit');
    return JSON.parse(raw);
  } catch (err) {
    metrics.recordCacheAccess(namespace, 'error');
    logger.warn('Cache get failed', {
      namespace,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * @param {string} namespace
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlSeconds
 */
async function cacheSet(namespace, key, value, ttlSeconds) {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('Cache set failed', {
      namespace,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * @param {string} key
 */
async function cacheDel(key) {
  try {
    await getRedis().del(key);
  } catch (err) {
    logger.warn('Cache del failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Delete keys matching a prefix via SCAN (production-safe).
 * @param {string} matchPattern - e.g. "leaderboard:*"
 */
async function cacheDelByPattern(matchPattern) {
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      // eslint-disable-next-line no-await-in-loop
      const [next, keys] = await redis.scan(cursor, 'MATCH', matchPattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Cache pattern delete failed', {
      matchPattern,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelByPattern,
};
