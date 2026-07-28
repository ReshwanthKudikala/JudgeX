// BullMQ queue definitions (infrastructure only — no worker/processor here).
//
// The submissions producer publishes judge jobs onto the `judge` queue
// (ARCHITECTURE.md §6.2, JUDGE_PIPELINE.md §2). Run jobs share the same queue
// with a distinct job name so the worker can dispatch without a second Redis
// queue. QueueEvents backs API-side waitUntilFinished for synchronous Run.

const { Queue, QueueEvents } = require('bullmq');

const { getRedis } = require('../cache/redis.cache');
const { logger } = require('../../shared/logger/logger');

const SUBMISSIONS_QUEUE_NAME = 'judge';

let submissionsQueue = null;
let judgeQueueEvents = null;

/**
 * Lazily construct and return the singleton submissions (judge) queue.
 * Reuses the already-connected shared Redis client.
 * @returns {import('bullmq').Queue}
 */
function getSubmissionsQueue() {
  if (!submissionsQueue) {
    submissionsQueue = new Queue(SUBMISSIONS_QUEUE_NAME, { connection: getRedis() });
    submissionsQueue.on('error', (err) => {
      logger.warn('Submissions queue error', { error: err.message });
    });
    logger.info('BullMQ submissions queue ready', { queue: SUBMISSIONS_QUEUE_NAME });
  }
  return submissionsQueue;
}

/**
 * QueueEvents for waiting on job completion (Run sync facade).
 * Uses a duplicated Redis connection (BullMQ blocking reads).
 * @returns {import('bullmq').QueueEvents}
 */
function getJudgeQueueEvents() {
  if (!judgeQueueEvents) {
    judgeQueueEvents = new QueueEvents(SUBMISSIONS_QUEUE_NAME, {
      connection: getRedis().duplicate(),
    });
    judgeQueueEvents.on('error', (err) => {
      logger.warn('Judge queue events error', { error: err.message });
    });
    logger.info('BullMQ judge queue events ready', { queue: SUBMISSIONS_QUEUE_NAME });
  }
  return judgeQueueEvents;
}

/**
 * Close the queue's own resources (does NOT close the shared Redis client —
 * that is owned by the cache module and closed separately during shutdown).
 */
async function closeSubmissionsQueue() {
  const closingEvents = judgeQueueEvents;
  judgeQueueEvents = null;
  if (closingEvents) {
    try {
      await closingEvents.close();
      logger.info('BullMQ judge queue events closed');
    } catch (err) {
      logger.warn('Error closing judge queue events', { error: err.message });
    }
  }

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

module.exports = {
  SUBMISSIONS_QUEUE_NAME,
  getSubmissionsQueue,
  getJudgeQueueEvents,
  closeSubmissionsQueue,
};
