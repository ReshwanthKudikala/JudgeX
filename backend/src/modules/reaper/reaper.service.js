// Stuck-queued submission reaper (persist-before-enqueue safety net).
//
// Finds submissions that stayed `queued` longer than a threshold (typically
// because enqueue failed after the DB commit) and re-enqueues them via the
// existing queue.service. jobId === submissionId gives BullMQ-side
// de-duplication so this pass cannot create duplicate judge jobs.
//
// Does NOT touch the judge pipeline, Docker, or the judge worker.

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { QueueError } = require('../../shared/errors/domain-errors');
const { enqueueSubmission } = require('../../infrastructure/queue/queue.service');
const { getSubmissionsQueue } = require('../../infrastructure/queue/queues');
const { submissionRepository } = require('../submissions/submissions.repository');

/** BullMQ states that mean a job for this submission is already in flight. */
const ACTIVE_JOB_STATES = new Set([
  'waiting',
  'active',
  'delayed',
  'paused',
  'waiting-children',
  'prioritized',
]);

/** Most recent sweep summary for readiness / ops diagnostics. */
let lastReaperSweep = null;

/**
 * @returns {object|null}
 */
function getLastReaperSweep() {
  return lastReaperSweep;
}
/**
 * True when BullMQ rejected an add because jobId already exists.
 * @param {unknown} err
 */
function isDuplicateJobError(err) {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof QueueError && err.details && err.details.cause
      ? String(err.details.cause)
      : '';
  const text = `${message} ${cause}`.toLowerCase();
  return text.includes('already exists') || text.includes('job id');
}

class ReaperService {
  constructor({
    submissionRepository: repo,
    enqueueSubmission: enqueueFn,
    getJob,
    stuckThresholdMs,
    batchSize,
  } = {}) {
    this.submissionRepository = repo || submissionRepository;
    this.enqueueSubmission = enqueueFn || enqueueSubmission;
    this.getJob =
      getJob ||
      (async (submissionId) => {
        const queue = getSubmissionsQueue();
        return queue.getJob(submissionId);
      });
    this.stuckThresholdMs = stuckThresholdMs ?? config.reaper.stuckThresholdMs;
    this.batchSize = batchSize ?? config.reaper.batchSize;
  }

  /**
   * One reconciliation pass over stuck `queued` submissions.
   *
   * @returns {Promise<{
   *   scanned: number,
   *   requeued: number,
   *   alreadyEnqueued: number,
   *   failed: number,
   *   redisUnavailable: boolean,
   * }>}
   */
  async sweep() {
    const olderThan = new Date(Date.now() - this.stuckThresholdMs);
    const rows = await this.submissionRepository.findStuckQueued({
      olderThan,
      limit: this.batchSize,
    });

    const summary = {
      scanned: rows.length,
      requeued: 0,
      alreadyEnqueued: 0,
      failed: 0,
      redisUnavailable: false,
    };

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop -- sequential to avoid stampeding Redis
      const outcome = await this.#reenqueueOne(row.id);
      if (outcome === 'requeued') summary.requeued += 1;
      else if (outcome === 'already_enqueued') summary.alreadyEnqueued += 1;
      else if (outcome === 'redis_unavailable') {
        summary.failed += 1;
        summary.redisUnavailable = true;
        // Further enqueues will fail the same way; stop this pass.
        break;
      } else {
        summary.failed += 1;
      }
    }

    logger.info('Queued-submission reaper sweep finished', summary);
    lastReaperSweep = {
      ...summary,
      finishedAt: new Date().toISOString(),
    };
    return summary;
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<'requeued'|'already_enqueued'|'redis_unavailable'|'failed'>}
   */
  async #reenqueueOne(submissionId) {
    try {
      const existing = await this.getJob(submissionId);
      if (existing) {
        const state = await existing.getState();
        if (ACTIVE_JOB_STATES.has(state) || state === 'completed' || state === 'failed') {
          // Job id is reserved — do not add again (JUDGE_PIPELINE.md §7).
          return 'already_enqueued';
        }
      }

      await this.enqueueSubmission(submissionId);
      return 'requeued';
    } catch (err) {
      if (isDuplicateJobError(err)) {
        return 'already_enqueued';
      }
      if (err instanceof QueueError) {
        logger.warn('Reaper could not enqueue submission', {
          submissionId,
          error: err.message,
          cause: err.details && err.details.cause,
        });
        return 'redis_unavailable';
      }
      logger.warn('Reaper unexpected error while re-enqueueing', {
        submissionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 'failed';
    }
  }
}

module.exports = {
  ReaperService,
  reaperService: new ReaperService(),
  isDuplicateJobError,
  ACTIVE_JOB_STATES,
  getLastReaperSweep,
};
