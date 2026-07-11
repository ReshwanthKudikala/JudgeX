// Redis cache for published editorials. Failures never break reads/writes.

const { getRedis } = require('../../infrastructure/cache/redis.cache');
const { logger } = require('../../shared/logger/logger');

const TTL_SECONDS = 300;
const PREFIX = 'editorial:published:slug:';

function cacheKey(slug) {
  return `${PREFIX}${slug}`;
}

async function getCachedEditorial(slug) {
  try {
    const redis = getRedis();
    const raw = await redis.get(cacheKey(slug));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Editorial cache get failed', {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function setCachedEditorial(slug, payload) {
  try {
    const redis = getRedis();
    await redis.set(cacheKey(slug), JSON.stringify(payload), 'EX', TTL_SECONDS);
  } catch (err) {
    logger.warn('Editorial cache set failed', {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function invalidateEditorialCache(slug) {
  if (!slug) return;
  try {
    const redis = getRedis();
    await redis.del(cacheKey(slug));
  } catch (err) {
    logger.warn('Editorial cache invalidate failed', {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

module.exports = {
  TTL_SECONDS,
  getCachedEditorial,
  setCachedEditorial,
  invalidateEditorialCache,
};
