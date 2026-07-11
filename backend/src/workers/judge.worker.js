// Background worker: consumes judge-queue jobs and invokes the judging pipeline.
// Observability: requestId from job payload, Redis heartbeat, metrics.
// Judge execution logic lives in judge.pipeline — unchanged here beyond timing/logs.

const { Worker } = require('bullmq');

const { config } = require('../config');
const { configure: configureLogger, createLogger } = require('../shared/logger/logger');
const { initInfrastructure, shutdownInfrastructure, getRedis } = require('../infrastructure');
const { SUBMISSIONS_QUEUE_NAME } = require('../infrastructure/queue/queues');
const { SCHEMA_VERSION } = require('../infrastructure/queue/queue.service');
const {
  writeWorkerHeartbeat,
} = require('../infrastructure/queue/worker-heartbeat');
const { submissionService } = require('../modules/submissions/submissions.service');
const { runJudgePipeline } = require('../modules/judge/judge.pipeline');
const { aiService } = require('../modules/ai/ai.service');
const { NotFoundError } = require('../shared/errors/http-errors');
const { metrics } = require('../shared/observability/metrics');
const {
  trackError,
  registerProcessErrorHandlers,
} = require('../shared/observability/error-tracking');

const log = createLogger({ component: 'judge-worker' });

const CONCURRENCY = 1;
const HEARTBEAT_INTERVAL_MS = 10_000;

const TERMINAL_STATUSES = new Set(['completed', 'error']);

/**
 * Validate the minimal job payload contract (JUDGE_PIPELINE.md §2).
 * Throws (→ job fails) on an unknown/mismatched shape.
 */
function assertValidPayload(data) {
  if (!data || typeof data.submissionId !== 'string' || data.submissionId.length === 0) {
    throw new Error('Invalid judge job payload: missing submissionId.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported judge job schemaVersion: got ${data.schemaVersion}, expected ${SCHEMA_VERSION}.`,
    );
  }
}

/**
 * Job processor. Returns a plain result (becomes the BullMQ job return value).
 * Throwing marks the job failed (BullMQ applies the producer-configured retries).
 */
async function processJob(job) {
  assertValidPayload(job.data);
  const { submissionId } = job.data;
  const requestId = job.data.requestId || job.data.correlationId || null;
  const jobLog = log.child({
    requestId,
    correlationId: requestId,
    submissionId,
    jobId: job.id,
  });

  const started = Date.now();
  jobLog.info('Processing judge job', { attempt: job.attemptsMade + 1 });

  let submission;
  try {
    submission = await submissionService.getSubmissionById(submissionId);
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new Error(`Submission ${submissionId} does not exist; failing job.`);
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

  await submissionService.markSubmissionRunning(submissionId);

  try {
    const outcome = await runJudgePipeline(submissionId);

    if (outcome.verdict === 'compile_error') {
      try {
        const judged = await submissionService.getSubmissionById(submissionId);
        await aiService.tryExplainAfterCompileError({
          submissionId,
          userId: judged.userId,
          language: judged.language,
          compileOutput: judged.compileOutput,
        });
      } catch (err) {
        jobLog.warn('Post-judge AI explanation hook failed; ignoring', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const durationSeconds = (Date.now() - started) / 1000;
    metrics.recordJudgeDuration(outcome.verdict, durationSeconds);
    metrics.recordJudgeJob('completed');
    jobLog.info('Submission judged', {
      verdict: outcome.verdict,
      durationMs: Math.round(durationSeconds * 1000),
    });
    return { submissionId, verdict: outcome.verdict };
  } catch (err) {
    metrics.recordJudgeJob('failed');
    trackError('judge.pipeline', err, { submissionId }, { log: jobLog });
    try {
      await submissionService.failSubmissionInternal(submissionId, {
        message: err instanceof Error ? err.message : String(err),
      });
    } catch (persistErr) {
      trackError('judge.persist_internal_error', persistErr, { submissionId }, { log: jobLog });
    }
    throw err;
  }
}

let worker = null;
let shuttingDown = false;
let heartbeatTimer = null;

function registerWorkerEvents(w) {
  w.on('active', (job) => {
    log.info('Job active', {
      jobId: job.id,
      submissionId: job.data && job.data.submissionId,
      requestId: job.data && job.data.requestId,
    });
  });
  w.on('completed', (job, result) => {
    log.info('Job completed', { jobId: job.id, result });
  });
  w.on('failed', (job, err) => {
    trackError(
      'bullmq.job_failed',
      err || new Error('unknown'),
      {
        jobId: job ? job.id : null,
        submissionId: job && job.data ? job.data.submissionId : null,
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
    await writeWorkerHeartbeat({ concurrency: CONCURRENCY });
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
  });
  registerWorkerEvents(worker);

  await beat();
  heartbeatTimer = setInterval(() => {
    void beat();
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

  log.info('Judge worker started', { queue: SUBMISSIONS_QUEUE_NAME, concurrency: CONCURRENCY });

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

module.exports = { processJob, start };
