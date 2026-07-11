const { getRedis } = require('../../infrastructure/cache/redis.cache');
const { logger } = require('../../shared/logger/logger');

const TTL_SECONDS = 30;
const PREFIX = 'admin:dashboard:';

async function cacheGet(key) {
  try {
    const raw = await getRedis().get(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('Admin dashboard cache get failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function cacheSet(key, value, ttl = TTL_SECONDS) {
  try {
    await getRedis().set(`${PREFIX}${key}`, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn('Admin dashboard cache set failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function cacheDel(key) {
  try {
    await getRedis().del(`${PREFIX}${key}`);
  } catch (err) {
    logger.warn('Admin dashboard cache del failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

module.exports = { cacheGet, cacheSet, cacheDel, TTL_SECONDS };
