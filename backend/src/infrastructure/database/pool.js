// Owns the PostgreSQL connection pool (the sole DB connection owner).
// Handles graceful startup (with retries), health checks, and clean shutdown.
// No application queries, repositories, or migrations live here.

const { Pool } = require('pg');
const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { sleep } = require('../../shared/utils');

let pool = null;

function createPool() {
  return new Pool({
    connectionString: config.database.url,
    max: config.database.poolMax,
    idleTimeoutMillis: config.database.idleTimeoutMs,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
  });
}

// Liveness probe: a trivial round-trip that proves the pool can reach the DB.
// This is a connectivity check, not an application/business query.
async function ping(p) {
  const client = await p.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/**
 * Connect the pool, retrying transient startup failures with a capped number
 * of attempts and a fixed delay. Idempotent: a second call returns the pool.
 */
async function connectPostgres({ retries = 0, delayMs = 1000 } = {}) {
  if (pool) return pool;

  const maxAttempts = retries + 1;
  const candidate = createPool();
  // Pool-level errors on idle clients must never crash the process.
  candidate.on('error', (err) => {
    logger.error('PostgreSQL idle client error', { error: err.message });
  });

  for (let attempt = 1; ; attempt += 1) {
    try {
      await ping(candidate);
      pool = candidate;
      logger.info('PostgreSQL connected', { poolMax: config.database.poolMax });
      return pool;
    } catch (err) {
      if (attempt >= maxAttempts) {
        await candidate.end().catch(() => {});
        throw new Error(
          `PostgreSQL connection failed after ${attempt} attempt(s): ${err.message}`,
        );
      }
      logger.warn('PostgreSQL connection attempt failed; retrying', {
        attempt,
        maxAttempts,
        delayMs,
        error: err.message,
      });
      await sleep(delayMs);
    }
  }
}

// Returns the live pool for repositories (added later). Throws if not started.
function getPool() {
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized. Call connectPostgres() first.');
  }
  return pool;
}

// Health probe for the future readiness endpoint (NOT used by /health yet).
async function checkPostgresHealth() {
  if (!pool) return { ok: false, error: 'not_initialized' };
  const start = Date.now();
  try {
    await ping(pool);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function closePostgres() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
  logger.info('PostgreSQL pool closed');
}

module.exports = { connectPostgres, getPool, checkPostgresHealth, closePostgres };
