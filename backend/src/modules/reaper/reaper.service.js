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
const { getRedis } = require('../../infrastructure/cache/redis.cache');
const { submissionRepository } = require('../submissions/submissions.repository');
const { submissionService } = require('../submissions/submissions.service');

/** One automatic requeue of a completed-but-unfinalized job, then a terminal error. */
const COMPLETED_RECOVERY_MAX = 1;
const COMPLETED_RECOVERY_TTL_SEC = 24 * 60 * 60;

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
    failSubmissionInternal,
    releaseRunningToQueued,
    noteCompletedRecovery,
    stuckThresholdMs,
    runningStuckThresholdMs,
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
    this.failSubmissionInternal =
      failSubmissionInternal ||
      ((id, opts) => submissionService.failSubmissionInternal(id, opts));
    this.releaseRunningToQueued =
      releaseRunningToQueued ||
      ((id) => this.submissionRepository.releaseRunningToQueued(id));
    this.noteCompletedRecovery = noteCompletedRecovery || noteCompletedRecoveryDefault;
    this.stuckThresholdMs = stuckThresholdMs ?? config.reaper.stuckThresholdMs;
    this.runningStuckThresholdMs =
      runningStuckThresholdMs ??
      config.reaper.runningStuckThresholdMs ??
      this.stuckThresholdMs;
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
    const queuedOlderThan = new Date(Date.now() - this.stuckThresholdMs);
    const runningOlderThan = new Date(Date.now() - this.runningStuckThresholdMs);

    const queued = await this.submissionRepository.findStuckQueued({
      olderThan: queuedOlderThan,
      limit: this.batchSize,
    });
    const findRunning = this.submissionRepository.findStuckRunning;
    const running =
      typeof findRunning === 'function'
        ? await findRunning.call(this.submissionRepository, {
            olderThan: runningOlderThan,
            limit: this.batchSize,
          })
        : [];

    const seen = new Set();
    const rows = [];
    for (const row of [...queued, ...running]) {
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }

    const summary = {
      scanned: rows.length,
      requeued: 0,
      alreadyEnqueued: 0,
      finalizedError: 0,
      failed: 0,
      redisUnavailable: false,
    };

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop -- sequential to avoid stampeding Redis
      const outcome = await this.#reenqueueOne(row);
      if (outcome === 'requeued') summary.requeued += 1;
      else if (outcome === 'already_enqueued') summary.alreadyEnqueued += 1;
      else if (outcome === 'finalized_error') summary.finalizedError += 1;
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
   * @param {{ id: string, status?: string }} row
   * @returns {Promise<'requeued'|'already_enqueued'|'finalized_error'|'redis_unavailable'|'failed'>}
   */
  async #reenqueueOne(row) {
    const submissionId = typeof row === 'string' ? row : row.id;
    const status = typeof row === 'string' ? undefined : row.status;

    try {
      const existing = await this.getJob(submissionId);
      if (existing) {
        const state = await existing.getState();
        if (ACTIVE_JOB_STATES.has(state)) {
          return 'already_enqueued';
        }
        if (state === 'completed') {
          return await this.#recoverCompletedWithoutVerdict(submissionId, status, existing);
        }
        if (state === 'failed') {
          // Retries exhausted in Redis; the row may still be non-terminal if
          // the worker died after the last throw. Persist a final error rather
          // than looping forever.
          try {
            await this.failSubmissionInternal(submissionId, {
              message: 'Judge job exhausted retries.',
            });
          } catch (err) {
            logger.warn('Reaper could not finalize exhausted job', {
              submissionId,
              error: err instanceof Error ? err.message : String(err),
            });
            return 'failed';
          }
          return 'finalized_error';
        }
      }

      if (status === 'running' && typeof this.releaseRunningToQueued === 'function') {
        await this.releaseRunningToQueued(submissionId);
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

  /**
   * BullMQ acked the job but Postgres is still queued/running.
   * Requeue at most once. A second observation writes internal_error via CAS,
   * which cannot overwrite a real terminal verdict. Unknown status is left alone.
   *
   * @param {string} submissionId
   * @param {string|undefined} status
   * @param {{ remove?: () => Promise<unknown> }} job
   */
  async #recoverCompletedWithoutVerdict(submissionId, status, job) {
    if (status !== 'queued' && status !== 'running') {
      return 'already_enqueued';
    }

    const seen = await this.noteCompletedRecovery(submissionId);
    if (seen > COMPLETED_RECOVERY_MAX) {
      await this.failSubmissionInternal(submissionId, {
        message: 'Judge job completed without a terminal verdict.',
      });
      return 'finalized_error';
    }

    if (job && typeof job.remove === 'function') {
      await job.remove();
    }
    if (status === 'running' && typeof this.releaseRunningToQueued === 'function') {
      await this.releaseRunningToQueued(submissionId);
    }
    await this.enqueueSubmission(submissionId);
    return 'requeued';
  }
}

/**
 * Count how many times this submission has been recovered from a completed job.
 * @param {string} submissionId
 * @returns {Promise<number>}
 */
async function noteCompletedRecoveryDefault(submissionId) {
  const redis = getRedis();
  const key = `judgex:reaper:completed-recovery:${submissionId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, COMPLETED_RECOVERY_TTL_SEC);
  }
  return count;
}

module.exports = {
  ReaperService,
  reaperService: new ReaperService(),
  isDuplicateJobError,
  ACTIVE_JOB_STATES,
  COMPLETED_RECOVERY_MAX,
  getLastReaperSweep,
};
