// Redis-backed cache and rate-limit counter store.
// Owns the singleton Redis connection (startup/health/shutdown).
// Rate-limit counters live in rate-limit.store.js.

const Redis = require('ioredis');
const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { sleep } = require('../../shared/utils');

let client = null;

function createClient() {
  // lazyConnect: we drive connection explicitly in the retry loop below.
  // maxRetriesPerRequest: null keeps commands queued during brief reconnects
  // (and is the setting BullMQ requires when it reuses this client later).
  const instance = new Redis(config.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  instance.on('error', (err) => {
    logger.warn('Redis client error', { error: err.message });
  });
  return instance;
}

/**
 * Connect a single shared Redis client, retrying transient startup failures
 * with a capped number of attempts. Idempotent once connected.
 */
async function connectRedis({ retries = 0, delayMs = 1000 } = {}) {
  if (client) return client;

  const maxAttempts = retries + 1;

  for (let attempt = 1; ; attempt += 1) {
    // Fresh instance per attempt avoids ioredis connect-state edge cases.
    const candidate = createClient();
    try {
      await candidate.connect();
      await candidate.ping();
      client = candidate;
      logger.info('Redis connected');
      return client;
    } catch (err) {
      candidate.disconnect();
      if (attempt >= maxAttempts) {
        throw new Error(
          `Redis connection failed after ${attempt} attempt(s): ${err.message}`,
        );
      }
      logger.warn('Redis connection attempt failed; retrying', {
        attempt,
        maxAttempts,
        delayMs,
        error: err.message,
      });
      await sleep(delayMs);
    }
  }
}

// Returns the live client for cache/queue usage (added later). Throws if unstarted.
function getRedis() {
  if (!client) {
    throw new Error('Redis client is not initialized. Call connectRedis() first.');
  }
  return client;
}

// Health probe for the future readiness endpoint (NOT used by /health yet).
async function checkRedisHealth() {
  if (!client) return { ok: false, error: 'not_initialized' };
  const start = Date.now();
  try {
    await client.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function closeRedis() {
  if (!client) return;
  const closing = client;
  client = null;
  try {
    await closing.quit();
  } catch {
    // If quit fails (e.g. already down), force-close the socket.
    closing.disconnect();
  }
  logger.info('Redis connection closed');
}

module.exports = { connectRedis, getRedis, checkRedisHealth, closeRedis };
