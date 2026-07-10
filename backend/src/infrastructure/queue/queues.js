// BullMQ queue definitions (infrastructure only — no worker/processor here).
//
// The submissions producer publishes judge jobs onto the `judge` queue
// (ARCHITECTURE.md §6.2, JUDGE_PIPELINE.md §2). The BullMQ Queue reuses the
// existing shared Redis connection (configured with maxRetriesPerRequest: null,
// which BullMQ requires). The queue is created lazily on first use so importing
// this module never forces a Redis connection at load time.

const { Queue } = require('bullmq');

const { getRedis } = require('../cache/redis.cache');
const { logger } = require('../../shared/logger/logger');

// Canonical queue name (kept as a shared constant so the future worker binds
// to exactly the same queue).
const SUBMISSIONS_QUEUE_NAME = 'judge';

let submissionsQueue = null;

/**
 * Lazily construct and return the singleton submissions (judge) queue.
 * Reuses the already-connected shared Redis client.
 * @returns {import('bullmq').Queue}
 */
function getSubmissionsQueue() {
  if (!submissionsQueue) {
    submissionsQueue = new Queue(SUBMISSIONS_QUEUE_NAME, { connection: getRedis() });
    // Surface queue-level errors without crashing the process.
    submissionsQueue.on('error', (err) => {
      logger.warn('Submissions queue error', { error: err.message });
    });
    logger.info('BullMQ submissions queue ready', { queue: SUBMISSIONS_QUEUE_NAME });
  }
  return submissionsQueue;
}

/**
 * Close the queue's own resources (does NOT close the shared Redis client —
 * that is owned by the cache module and closed separately during shutdown).
 */
async function closeSubmissionsQueue() {
  if (!submissionsQueue) return;
  const closing = submissionsQueue;
  submissionsQueue = null;
  try {
    await closing.close();
    logger.info('BullMQ submissions queue closed');
  } catch (err) {
    logger.warn('Error closing submissions queue', { error: err.message });
  }
}

module.exports = { SUBMISSIONS_QUEUE_NAME, getSubmissionsQueue, closeSubmissionsQueue };
