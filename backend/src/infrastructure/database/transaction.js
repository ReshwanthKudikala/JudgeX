// Transaction helper implementing unit-of-work semantics.
//
// `withTransaction` acquires a dedicated client, wraps a callback in
// BEGIN/COMMIT, rolls back on any error, and always releases the client.
// Repositories run their statements against the client passed to the callback,
// so a whole unit of work commits or aborts atomically (DATABASE_DESIGN.md §7).

const { getPool } = require('./pool');
const { logger } = require('../../shared/logger/logger');
const { mapDatabaseError } = require('./errors');

// Only these isolation levels may be requested; the value is validated against
// this allow-set before being placed in the BEGIN statement (never user input).
const ISOLATION_LEVELS = new Set(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']);

/**
 * Run `callback` inside a single database transaction.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback - receives
 *        the transaction client; use it for every statement in the unit of work.
 * @param {{ isolationLevel?: 'READ COMMITTED'|'REPEATABLE READ'|'SERIALIZABLE' }} [options]
 * @returns {Promise<T>} the callback's resolved value (after COMMIT).
 */
async function withTransaction(callback, { isolationLevel } = {}) {
  if (typeof callback !== 'function') {
    throw new TypeError('withTransaction(callback) requires a callback function.');
  }
  if (isolationLevel && !ISOLATION_LEVELS.has(isolationLevel)) {
    throw new Error(`Unsupported transaction isolation level: ${isolationLevel}`);
  }

  const client = await getPool().connect();
  let began = false;

  try {
    await client.query(isolationLevel ? `BEGIN ISOLATION LEVEL ${isolationLevel}` : 'BEGIN');
    began = true;

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // A failed rollback must not mask the original error; log and continue.
        logger.error('Transaction rollback failed', { error: rollbackErr.message });
      }
    }
    // Propagate a mapped application error (pass-through if already an AppError).
    throw mapDatabaseError(err);
  } finally {
    // Safe cleanup: the client is always returned to the pool.
    client.release();
  }
}

module.exports = { withTransaction };
