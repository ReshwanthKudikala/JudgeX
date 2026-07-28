// Thin producer abstraction over the submissions (judge) queue.
//
// The rest of the app enqueues judge work through this module only; it never
// touches BullMQ directly. No worker, processor, Docker, or judging logic lives
// here — this is the enqueue side of the pipeline (JUDGE_PIPELINE.md §2, §6).
//
// Run jobs: enqueue + waitUntilFinished so the HTTP handler stays sync for the
// browser while Docker execution stays on the judge worker.

const { getSubmissionsQueue, getJudgeQueueEvents } = require('./queues');
const { QueueError } = require('../../shared/errors/domain-errors');

const SCHEMA_VERSION = 1;

const JOB_NAME = 'judge-submission';
const RUN_JOB_NAME = 'run-code';

const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
  removeOnFail: { count: 5000 },
});

/** Run jobs: single attempt; short retention (result returned inline). */
const RUN_JOB_OPTIONS = Object.freeze({
  attempts: 1,
  removeOnComplete: { count: 200, age: 5 * 60 },
  removeOnFail: { count: 200, age: 30 * 60 },
});

/** Default API wait budget for a Run (compile + samples + queue wait). */
const DEFAULT_RUN_WAIT_MS = 90_000;

/**
 * Enqueue a submission for asynchronous judging.
 *
 * @param {string} submissionId
 * @param {{ requestId?: string }} [meta]
 * @returns {Promise<import('bullmq').Job>}
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

/**
 * Enqueue a Run job on the judge worker and wait for its return value.
 * Does not touch Docker on the API process.
 *
 * @param {{
 *   problemId: string,
 *   language: string,
 *   sourceCode: string,
 *   customInput?: string,
 *   requestId?: string,
 * }} payload
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<object>} worker return value (Run response body)
 */
async function enqueueRunAndWait(payload, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_RUN_WAIT_MS;
  const queue = getSubmissionsQueue();
  const events = getJudgeQueueEvents();

  const data = {
    problemId: payload.problemId,
    language: payload.language,
    sourceCode: payload.sourceCode,
    schemaVersion: SCHEMA_VERSION,
    enqueuedAt: new Date().toISOString(),
  };
  if (payload.customInput !== undefined) {
    data.customInput = payload.customInput;
  }
  if (payload.requestId) {
    data.requestId = payload.requestId;
  }

  let job;
  try {
    job = await queue.add(RUN_JOB_NAME, data, { ...RUN_JOB_OPTIONS });
  } catch (err) {
    throw new QueueError('Failed to enqueue code run.', {
      problemId: payload.problemId,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    return await job.waitUntilFinished(events, timeoutMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new QueueError('Code run did not complete in time or failed on the worker.', {
      problemId: payload.problemId,
      jobId: job.id,
      cause: message,
    });
  }
}

module.exports = {
  enqueueSubmission,
  enqueueRunAndWait,
  SCHEMA_VERSION,
  JOB_NAME,
  RUN_JOB_NAME,
  DEFAULT_JOB_OPTIONS,
  RUN_JOB_OPTIONS,
  DEFAULT_RUN_WAIT_MS,
};
