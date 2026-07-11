// Redis fixed-window rate-limit counters. Failures are surfaced to the caller
// so middleware can choose fail-open vs fail-closed per endpoint tier.

const { getRedis } = require('./redis.cache');

/**
 * Increment a counter for `key` within a fixed window.
 *
 * @param {string} key
 * @param {number} windowMs
 * @returns {Promise<{ count: number, ttlMs: number, resetAt: number }>}
 */
async function incrementWindow(key, windowMs) {
  const redis = getRedis();
  const count = await redis.incr(key);

  let ttlMs = await redis.pttl(key);
  if (count === 1 || ttlMs < 0) {
    await redis.pexpire(key, windowMs);
    ttlMs = windowMs;
  }

  return {
    count,
    ttlMs,
    resetAt: Date.now() + ttlMs,
  };
}

/**
 * Best-effort check whether Redis is usable for rate limiting.
 * @returns {boolean}
 */
function isRateLimitStoreReady() {
  try {
    getRedis();
    return true;
  } catch {
    return false;
  }
}

module.exports = { incrementWindow, isRateLimitStoreReady };
