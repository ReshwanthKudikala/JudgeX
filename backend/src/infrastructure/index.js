// Infrastructure lifecycle: connect backing services at startup, expose reusable
// instances, and tear them down cleanly. This is the single orchestration point
// wired into the server (and later, workers).

const { config } = require('../config');
const { logger } = require('../shared/logger/logger');
const {
  connectPostgres,
  getPool,
  checkPostgresHealth,
  closePostgres,
} = require('./database/pool');
const {
  connectRedis,
  getRedis,
  checkRedisHealth,
  closeRedis,
} = require('./cache/redis.cache');

// Connect one service; fail fast if it is required, otherwise degrade.
async function connectService(name, connectFn, required) {
  try {
    await connectFn();
  } catch (err) {
    if (required) {
      logger.error(`${name} is required but failed to connect; aborting startup`, {
        error: err.message,
      });
      throw err;
    }
    logger.warn(`${name} unavailable; continuing in degraded mode`, {
      error: err.message,
    });
  }
}

/**
 * Initialize all infrastructure. Retries are capped by config; a required
 * service that stays unreachable aborts startup (the caller exits the process).
 */
async function initInfrastructure() {
  const retryOptions = {
    retries: config.infra.startupRetries,
    delayMs: config.infra.startupRetryDelayMs,
  };

  await connectService('PostgreSQL', () => connectPostgres(retryOptions), config.database.required);
  await connectService('Redis', () => connectRedis(retryOptions), config.redis.required);

  logger.info('Infrastructure initialized');
}

// Close everything, tolerating individual failures so one hang can't block others.
async function shutdownInfrastructure() {
  await Promise.allSettled([closePostgres(), closeRedis()]);
}

module.exports = {
  initInfrastructure,
  shutdownInfrastructure,
  // Reusable instance accessors for later layers.
  getPool,
  getRedis,
  // Health probes for the future readiness endpoint.
  checkPostgresHealth,
  checkRedisHealth,
};
