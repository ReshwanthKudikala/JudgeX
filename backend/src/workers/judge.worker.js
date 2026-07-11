// Background worker: consumes judge-queue jobs and (eventually) invokes the
// judging pipeline. THIS SPRINT IS A SKELETON: it validates the job, loads the
// submission, enforces the idempotency guard, and marks it running — then stops.
// No Docker, compilation, execution, comparison, or verdict generation yet.
//
// Runs as its own process: `node src/workers/judge.worker.js`. It connects the
// same infrastructure (PostgreSQL for SubmissionService, Redis for BullMQ) and
// binds to the existing "judge" queue defined in infrastructure/queue/queues.js.

const { Worker } = require('bullmq');

const { config } = require('../config');
const { configure: configureLogger, createLogger } = require('../shared/logger/logger');
const { initInfrastructure, shutdownInfrastructure, getRedis } = require('../infrastructure');
const { SUBMISSIONS_QUEUE_NAME } = require('../infrastructure/queue/queues');
const { SCHEMA_VERSION } = require('../infrastructure/queue/queue.service');
const { submissionService } = require('../modules/submissions/submissions.service');
const { runJudgePipeline } = require('../modules/judge/judge.pipeline');
const { aiService } = require('../modules/ai/ai.service');
const { NotFoundError } = require('../shared/errors/http-errors');

const log = createLogger({ component: 'judge-worker' });

// Skeleton concurrency: judging is CPU/Docker-bound, so this is tuned to cores
// once execution exists (ARCHITECTURE.md §4.3). One slot is enough for now.
const CONCURRENCY = 1;

// Statuses that are terminal — a job for one of these must not be reprocessed.
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

  log.info('Processing judge job', { jobId: job.id, submissionId, attempt: job.attemptsMade + 1 });

  // Load the authoritative submission (Postgres is the source of truth).
  let submission;
  try {
    submission = await submissionService.getSubmissionById(submissionId);
  } catch (err) {
    if (err instanceof NotFoundError) {
      // No backing row → nothing to judge; fail the job (do not retry-loop forever).
      throw new Error(`Submission ${submissionId} does not exist; failing job.`);
    }
    throw err;
  }

  // Idempotency guard: never re-finalize/reprocess a terminal submission.
  if (TERMINAL_STATUSES.has(submission.status)) {
    log.info('Submission already terminal; skipping', {
      submissionId,
      status: submission.status,
    });
    return { submissionId, skipped: true, status: submission.status };
  }

  // Transition queued → running (worker has picked it up).
  await submissionService.markSubmissionRunning(submissionId);

  try {
    // Delegate the compile → run → compare → verdict → persist flow to the pipeline.
    const outcome = await runJudgePipeline(submissionId);

    // Non-critical path: after a CE verdict, optionally generate + persist an
    // explanation. Failures are swallowed so judging remains authoritative.
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
        log.warn('Post-judge AI explanation hook failed; ignoring', {
          submissionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.info('Submission judged', { submissionId, verdict: outcome.verdict });
    return { submissionId, verdict: outcome.verdict };
  } catch (err) {
    // Persist Internal Error so the submission does not stay stuck in `running`.
    try {
      await submissionService.failSubmissionInternal(submissionId, {
        message: err instanceof Error ? err.message : String(err),
      });
    } catch (persistErr) {
      log.error('Failed to persist internal_error after judge failure', {
        submissionId,
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }
    throw err;
  }
}

let worker = null;
let shuttingDown = false;

function registerWorkerEvents(w) {
  w.on('active', (job) => {
    log.info('Job active', { jobId: job.id, submissionId: job.data && job.data.submissionId });
  });
  w.on('completed', (job, result) => {
    log.info('Job completed', { jobId: job.id, result });
  });
  w.on('failed', (job, err) => {
    log.warn('Job failed', {
      jobId: job ? job.id : null,
      submissionId: job && job.data ? job.data.submissionId : null,
      error: err ? err.message : 'unknown',
    });
  });
  w.on('error', (err) => {
    log.error('Worker error', { error: err.message });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Worker shutdown initiated', { signal });

  const forceTimer = setTimeout(() => {
    log.error('Worker graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (worker) {
      // close() stops pulling new jobs and waits for in-flight jobs to finish.
      await worker.close();
      log.info('Worker closed');
    }
    await shutdownInfrastructure();
    clearTimeout(forceTimer);
    log.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    log.error('Error during worker shutdown', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

async function start() {
  configureLogger({ level: config.logging.level });

  try {
    await initInfrastructure();
  } catch (err) {
    log.error('Infrastructure initialization failed; worker aborting', { error: err.message });
    await shutdownInfrastructure();
    process.exit(1);
  }

  worker = new Worker(SUBMISSIONS_QUEUE_NAME, processJob, {
    connection: getRedis(),
    concurrency: CONCURRENCY,
  });
  registerWorkerEvents(worker);

  log.info('Judge worker started', { queue: SUBMISSIONS_QUEUE_NAME, concurrency: CONCURRENCY });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
    shutdown('unhandledRejection');
  });
}

// Only auto-boot when run as the process entrypoint (keeps processJob unit-testable).
if (require.main === module) {
  start();
}

module.exports = { processJob, start };
