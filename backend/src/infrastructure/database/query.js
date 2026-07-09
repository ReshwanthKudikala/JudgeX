// Parameterized query execution against the pool or a transaction client.
// The single choke point for running SQL: enforces $-placeholder parameters and
// maps driver errors into the application error hierarchy. No SQL is built here.

const { getPool } = require('./pool');
const { logger } = require('../../shared/logger/logger');
const { mapDatabaseError } = require('./errors');

/**
 * Execute a parameterized statement.
 *
 * @param {string} text - SQL with $1, $2, ... placeholders (never interpolated).
 * @param {Array} [params] - positional parameter values.
 * @param {import('pg').PoolClient} [client] - a transaction client; when omitted
 *        the shared pool is used (pool auto-manages a connection per call).
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = [], client) {
  const executor = client || getPool();
  const start = Date.now();
  try {
    const result = await executor.query(text, params);
    // Never log parameter values — they may contain secrets/PII.
    logger.debug('SQL executed', {
      durationMs: Date.now() - start,
      rowCount: result.rowCount,
    });
    return result;
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

// Returns the first row or null.
async function queryOne(text, params, client) {
  const result = await query(text, params, client);
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Returns all rows (possibly empty array).
async function queryMany(text, params, client) {
  const result = await query(text, params, client);
  return result.rows;
}

module.exports = { query, queryOne, queryMany };
