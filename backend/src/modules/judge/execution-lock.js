// One sandbox at a time per submission.
//
// BullMQ's job lock stops a second worker only while the lock is renewed.
// A stalled worker, or a second job id created by recovery, can otherwise
// enter the pipeline while the first sandbox is still running.
// `running -> running` stays legal so a retry after a crash can continue.
// This session lock is what keeps those attempts from overlapping.
//
// The lock is a Postgres advisory lock on its own connection, not a pool
// client, so a long compile cannot exhaust the application pool. It is
// released when the attempt finishes or the process drops the connection.

const { Client } = require('pg');

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');

/**
 * Two signed int4 keys from a submission UUID. Advisory locks take int4 pairs.
 * @param {string} submissionId
 * @returns {[number, number]}
 */
function advisoryKey(submissionId) {
  const hex = String(submissionId).replace(/-/g, '');
  if (hex.length < 16) {
    throw new Error('Submission id is too short for an execution lock.');
  }
  const a = Buffer.from(hex.slice(0, 8), 'hex').readInt32BE(0);
  const b = Buffer.from(hex.slice(8, 16), 'hex').readInt32BE(0);
  return [a, b];
}

/**
 * @param {string} submissionId
 * @returns {Promise<{ acquired: boolean, release: () => Promise<void> }>}
 */
async function acquireSubmissionExecutionLock(submissionId) {
  const client = new Client({ connectionString: config.database.url });
  // A dropped session releases the advisory lock. Without a listener, node-pg
  // turns that socket error into an uncaught exception and crashes the worker.
  client.on('error', (err) => {
    logger.warn('Submission execution lock connection closed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  await client.connect();
  const [k1, k2] = advisoryKey(submissionId);
  try {
    const { rows } = await client.query(
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked',
      [k1, k2],
    );
    if (!rows[0] || rows[0].locked !== true) {
      await client.end();
      return { acquired: false, release: async () => {} };
    }
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }

  let released = false;
  return {
    acquired: true,
    release: async () => {
      if (released) return;
      released = true;
      try {
        await client.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', [k1, k2]);
      } finally {
        await client.end();
      }
    },
  };
}

module.exports = {
  advisoryKey,
  acquireSubmissionExecutionLock,
};
