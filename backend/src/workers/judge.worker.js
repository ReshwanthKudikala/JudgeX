// Background worker: consumes judge-queue jobs and invokes the judging pipeline
// or Run execution. Observability: requestId from job payload, Redis heartbeat.
//
// Docker / sandboxes run ONLY here — never in the API process.
// Submit → runJudgePipeline; Run → executeCodeRun (shared ExecutionService).

const { Worker, UnrecoverableError, DelayedError } = require('bullmq');

const { config } = require('../config');
const { configure: configureLogger, createLogger } = require('../shared/logger/logger');
const { initInfrastructure, shutdownInfrastructure, getRedis } = require('../infrastructure');
const { SUBMISSIONS_QUEUE_NAME } = require('../infrastructure/queue/queues');
const {
  SCHEMA_VERSION,
  JOB_NAME,
  RUN_JOB_NAME,
} = require('../infrastructure/queue/queue.service');
const {
  writeWorkerHeartbeat,
} = require('../infrastructure/queue/worker-heartbeat');
const { checkDockerHealth } = require('../infrastructure/docker/docker.adapter');
const { submissionService } = require('../modules/submissions/submissions.service');
const { runJudgePipeline } = require('../modules/judge/judge.pipeline');
const { executeCodeRun } = require('../modules/code/code.service');
const { NotFoundError, ValidationError, ConflictError } = require('../shared/errors/http-errors');
const {
  TERMINAL_STATUSES,
  isLastAttempt,
  isUnrecoverableJudgeError,
} = require('../modules/judge/job-lifecycle');
const { acquireSubmissionExecutionLock } = require('../modules/judge/execution-lock');
const { metrics } = require('../shared/observability/metrics');
const {
  trackError,
  registerProcessErrorHandlers,
} = require('../shared/observability/error-tracking');
const {
  invalidateLeaderboardCache,
} = require('../modules/leaderboard/leaderboard.cache');

const log = createLogger({ component: 'judge-worker' });

const CONCURRENCY = Math.max(1, Number(config.judge.workerConcurrency) || 2);
const LOCK_DURATION_MS = Math.max(30_000, Number(config.judge.lockDurationMs) || 300_000);
const HEARTBEAT_INTERVAL_MS = 10_000;
const DUPLICATE_EXECUTION_DELAY_MS = 2_000;

function isDelayedError(err) {
  return err instanceof DelayedError || (err && err.name === 'DelayedError');
}

/**
 * Another attempt already holds the submission execution lock.
 * Move this delivery later without burning a retry or writing a verdict.
 * @param {import('bullmq').Job} job
 * @param {object} jobLog
 * @param {string} submissionId
 */
async function deferDuplicateExecution(job, jobLog, submissionId) {
  jobLog.info('Submission execution already in progress; delaying duplicate', {
    submissionId,
    delayMs: DUPLICATE_EXECUTION_DELAY_MS,
  });
  if (typeof job.moveToDelayed === 'function') {
    try {
      await job.moveToDelayed(Date.now() + DUPLICATE_EXECUTION_DELAY_MS, job.token);
    } catch (err) {
      jobLog.warn('Could not delay duplicate execution', {
        submissionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  throw new DelayedError('Submission execution already in progress');
}

function assertValidSubmissionPayload(data) {
  if (!data || typeof data.submissionId !== 'string' || data.submissionId.length === 0) {
    throw new UnrecoverableError('Invalid judge job payload: missing submissionId.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new UnrecoverableError(
      `Unsupported judge job schemaVersion: got ${data.schemaVersion}, expected ${SCHEMA_VERSION}.`,
    );
  }
}

function assertValidRunPayload(data) {
  if (!data || typeof data.problemId !== 'string' || !data.problemId) {
    throw new Error('Invalid run job payload: missing problemId.');
  }
  if (typeof data.language !== 'string' || !data.language) {
    throw new Error('Invalid run job payload: missing language.');
  }
  if (typeof data.sourceCode !== 'string' || !data.sourceCode) {
    throw new Error('Invalid run job payload: missing sourceCode.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported run job schemaVersion: got ${data.schemaVersion}, expected ${SCHEMA_VERSION}.`,
    );
  }
}

/**
 * Run job: execute public samples / custom stdin via ExecutionService.
 * Return value is delivered to the API through waitUntilFinished.
 */
async function processRunJob(job) {
  assertValidRunPayload(job.data);
  const requestId = job.data.requestId || job.data.correlationId || null;
  const jobLog = log.child({
    requestId,
    correlationId: requestId,
    problemId: job.data.problemId,
    jobId: job.id,
    jobName: RUN_JOB_NAME,
  });

  if (job.data.enqueuedAt) {
    const waitMs = Date.now() - new Date(job.data.enqueuedAt).getTime();
    metrics.recordQueueWait(waitMs / 1000);
  }

  const started = Date.now();
  jobLog.info('Processing run job', { attempt: job.attemptsMade + 1 });

  try {
    const result = await executeCodeRun({
      problemId: job.data.problemId,
      language: job.data.language,
      sourceCode: job.data.sourceCode,
      customInput: job.data.customInput,
      cases: job.data.cases,
    });
    jobLog.info('Run job finished', {
      status: result.status,
      durationMs: Date.now() - started,
      totalCount: result.totalCount,
    });
    return result;
  } catch (err) {
    // ValidationError (e.g. no public samples) should fail the job with a clear reason.
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      jobLog.warn('Run job rejected', {
        code: err.code,
        message: err.message,
      });
    } else {
      trackError('code.run', err, { problemId: job.data.problemId }, { log: jobLog });
    }
    throw err;
  }
}

/**
 * Persist `error`/`internal_error` only when no further BullMQ attempt will run.
 * A ConflictError means another worker already wrote a terminal verdict — ignore.
 *
 * @param {object} submissions
 * @param {string} submissionId
 * @param {unknown} err
 * @param {object} jobLog
 */
async function persistFinalFailure(submissions, submissionId, err, jobLog) {
  try {
    await submissions.failSubmissionInternal(submissionId, {
      message: err instanceof Error ? err.message : String(err),
    });
  } catch (persistErr) {
    if (persistErr instanceof ConflictError || persistErr instanceof NotFoundError) {
      jobLog.info('Submission already terminal while persisting failure', {
        submissionId,
      });
      return;
    }
    trackError('judge.persist_internal_error', persistErr, { submissionId }, { log: jobLog });
  }
}

/**
 * Submit job processor.
 *
 * Retry policy:
 *   - Legitimate verdicts (AC/WA/TLE/RE/CE/MLE) are successful jobs; they
 *     persist `completed` inside the pipeline and are never retried.
 *   - Infrastructure failures throw so BullMQ can retry. `error` is written
 *     only on the last attempt or for unrecoverable (deterministic) errors.
 *   - Cache invalidation after a successful verdict must not fail the job
 *     (that used to overwrite AC with internal_error).
 *
 * @param {import('bullmq').Job} job
 * @param {{
 *   submissions?: object,
 *   runPipeline?: Function,
 *   invalidateLeaderboardCache?: Function,
 *   acquireExecutionLock?: (submissionId: string) => Promise<{ acquired: boolean, release: () => Promise<void> }>,
 * }} [deps]
 */
async function processSubmissionJob(job, deps = {}) {
  const submissions = deps.submissions || submissionService;
  const runPipeline = deps.runPipeline || runJudgePipeline;
  const invalidateCache = deps.invalidateLeaderboardCache || invalidateLeaderboardCache;
  const acquireExecutionLock = deps.acquireExecutionLock || acquireSubmissionExecutionLock;

  assertValidSubmissionPayload(job.data);
  const { submissionId } = job.data;
  const requestId = job.data.requestId || job.data.correlationId || null;
  const jobLog = log.child({
    requestId,
    correlationId: requestId,
    submissionId,
    jobId: job.id,
  });

  if (job.data.enqueuedAt) {
    const waitMs = Date.now() - new Date(job.data.enqueuedAt).getTime();
    metrics.recordQueueWait(waitMs / 1000);
  }

  const started = Date.now();
  const attempt = (Number(job.attemptsMade) || 0) + 1;
  jobLog.info('Processing judge job', { attempt, lastAttempt: isLastAttempt(job) });

  let submission;
  try {
    submission = await submissions.getSubmissionById(submissionId);
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new UnrecoverableError(`Submission ${submissionId} does not exist; failing job.`);
    }
    throw err;
  }

  if (TERMINAL_STATUSES.has(submission.status)) {
    jobLog.info('Submission already terminal; skipping', {
      status: submission.status,
    });
    metrics.recordJudgeJob('skipped');
    return { submissionId, skipped: true, status: submission.status };
  }

  try {
    await submissions.markSubmissionRunning(submissionId);
  } catch (err) {
    if (err instanceof ConflictError) {
      jobLog.info('Submission became terminal before running; skipping', {
        submissionId,
      });
      metrics.recordJudgeJob('skipped');
      return { submissionId, skipped: true };
    }
    throw err;
  }

  let lock = null;
  try {
    lock = await acquireExecutionLock(submissionId);
    if (!lock || !lock.acquired) {
      await deferDuplicateExecution(job, jobLog, submissionId);
    }

    const outcome = await runPipeline(submissionId);

    const durationSeconds = (Date.now() - started) / 1000;
    metrics.recordJudgeDuration(outcome.verdict, durationSeconds);
    metrics.recordJudgeJob('completed');
    if (outcome.verdict === 'accepted') {
      try {
        await invalidateCache();
      } catch (cacheErr) {
        jobLog.warn('Leaderboard cache invalidation failed after accepted verdict', {
          error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
        });
      }
    }
    jobLog.info('Submission judged', {
      verdict: outcome.verdict,
      durationMs: Math.round(durationSeconds * 1000),
    });
    return { submissionId, verdict: outcome.verdict };
  } catch (err) {
    if (isDelayedError(err)) {
      throw err;
    }
    if (err instanceof ConflictError) {
      jobLog.info('Submission already finalized by another worker; skipping', {
        submissionId,
      });
      metrics.recordJudgeJob('skipped');
      return { submissionId, skipped: true };
    }

    metrics.recordJudgeJob('failed');
    trackError('judge.pipeline', err, { submissionId }, { log: jobLog });

    const unrecoverable = isUnrecoverableJudgeError(err);
    const last = isLastAttempt(job);
    if (unrecoverable || last) {
      await persistFinalFailure(submissions, submissionId, err, jobLog);
    } else {
      jobLog.warn('Retryable judge failure; leaving submission non-terminal', {
        submissionId,
        attempt,
      });
    }

    if (unrecoverable) {
      throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
    }
    throw err;
  } finally {
    if (lock && lock.acquired && typeof lock.release === 'function') {
      try {
        await lock.release();
      } catch (releaseErr) {
        jobLog.warn('Failed to release submission execution lock', {
          submissionId,
          error: releaseErr instanceof Error ? releaseErr.message : String(releaseErr),
        });
      }
    }
  }
}

/**
 * Dispatch by job name: run-code vs judge-submission.
 */
async function processJob(job) {
  if (job.name === RUN_JOB_NAME) {
    return processRunJob(job);
  }
  // Default / JOB_NAME: submission judging (backward compatible).
  if (job.name && job.name !== JOB_NAME) {
    log.warn('Unknown judge queue job name; treating as submission', {
      jobName: job.name,
      jobId: job.id,
    });
  }
  return processSubmissionJob(job);
}

let worker = null;
let shuttingDown = false;
let heartbeatTimer = null;

function registerWorkerEvents(w) {
  w.on('active', (job) => {
    log.info('Job active', {
      jobId: job.id,
      jobName: job.name,
      submissionId: job.data && job.data.submissionId,
      problemId: job.data && job.data.problemId,
      requestId: job.data && job.data.requestId,
    });
  });
  w.on('completed', (job, result) => {
    log.info('Job completed', { jobId: job.id, jobName: job.name, result });
  });
  w.on('failed', (job, err) => {
    trackError(
      'bullmq.job_failed',
      err || new Error('unknown'),
      {
        jobId: job ? job.id : null,
        jobName: job ? job.name : null,
        submissionId: job && job.data ? job.data.submissionId : null,
        problemId: job && job.data ? job.data.problemId : null,
        requestId: job && job.data ? job.data.requestId : null,
      },
    );
  });
  w.on('error', (err) => {
    trackError('bullmq.worker_error', err);
  });
}

async function beat() {
  try {
    const docker = await checkDockerHealth();
    await writeWorkerHeartbeat({
      concurrency: CONCURRENCY,
      docker: {
        ok: docker.ok,
        ...(docker.error ? { error: docker.error } : {}),
      },
    });
  } catch (err) {
    log.warn('Worker heartbeat failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Worker shutdown initiated', { signal });

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  const forceTimer = setTimeout(() => {
    log.error('Worker graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (worker) {
      await worker.close();
      log.info('Worker closed');
    }
    await shutdownInfrastructure();
    clearTimeout(forceTimer);
    log.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    trackError('judge.worker_shutdown', err);
    process.exit(1);
  }
}

async function start() {
  configureLogger({
    level: config.logging.level,
    format: config.logging.format,
  });

  try {
    await initInfrastructure();
  } catch (err) {
    trackError('judge.worker_boot', err);
    await shutdownInfrastructure();
    process.exit(1);
  }

  worker = new Worker(SUBMISSIONS_QUEUE_NAME, processJob, {
    connection: getRedis(),
    concurrency: CONCURRENCY,
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: 2,
  });
  registerWorkerEvents(worker);

  await beat();
  heartbeatTimer = setInterval(() => {
    void beat();
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

  log.info('Judge worker started', {
    queue: SUBMISSIONS_QUEUE_NAME,
    concurrency: CONCURRENCY,
    lockDurationMs: LOCK_DURATION_MS,
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  registerProcessErrorHandlers({
    component: 'judge-worker',
    onFatal: (signal) => shutdown(signal),
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  processJob,
  processRunJob,
  processSubmissionJob,
  persistFinalFailure,
  start,
};
