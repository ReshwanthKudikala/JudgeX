// Thin producer abstraction over the submissions (judge) queue.
//
// The rest of the app enqueues judge work through this module only; it never
// touches BullMQ directly. No worker, processor, Docker, or judging logic lives
// here — this is the enqueue side of the pipeline (JUDGE_PIPELINE.md §2, §6).

const { getSubmissionsQueue } = require('./queues');
const { QueueError } = require('../../shared/errors/domain-errors');

// Job payload/contract version, so a rolling worker deploy can detect an
// unknown shape (JUDGE_PIPELINE.md §2).
const SCHEMA_VERSION = 1;

// Logical job name within the queue (aids observability/filtering).
const JOB_NAME = 'judge-submission';

// Per-job options straight from the design doc (JUDGE_PIPELINE.md §2, §6):
// bounded transient-failure retries with exponential backoff, and bounded
// retention so Redis does not grow without limit.
const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }, // 2s → 4s → 8s
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 }, // keep a short, bounded window
  removeOnFail: { count: 5000 }, // retain failed jobs (bounded) for inspection
});

/**
 * Enqueue a submission for asynchronous judging.
 *
 * The payload carries ONLY a reference + metadata — the worker re-reads the
 * authoritative submission/problem/test-cases from PostgreSQL. jobId is set to
 * the submissionId for enqueue-side de-duplication (JUDGE_PIPELINE.md §7).
 *
 * @param {string} submissionId - UUID of the persisted (queued) submission.
 * @param {{ requestId?: string }} [meta] - optional observability context.
 * @returns {Promise<import('bullmq').Job>} the enqueued job.
 * @throws {QueueError} when the job cannot be enqueued (e.g. Redis unavailable).
 */
async function enqueueSubmission(submissionId, meta = {}) {
  const queue = getSubmissionsQueue();

  const payload = {
    submissionId,
    schemaVersion: SCHEMA_VERSION,
    enqueuedAt: new Date().toISOString(),
  };
  if (meta.requestId) {
    payload.requestId = meta.requestId;
  }

  try {
    return await queue.add(JOB_NAME, payload, {
      jobId: submissionId,
      ...DEFAULT_JOB_OPTIONS,
    });
  } catch (err) {
    throw new QueueError('Failed to enqueue submission for judging.', {
      submissionId,
      cause: err.message,
    });
  }
}

module.exports = {
  enqueueSubmission,
  SCHEMA_VERSION,
  JOB_NAME,
  DEFAULT_JOB_OPTIONS,
};
