/**
 * E2E harness: real Postgres + Redis + BullMQ worker + Docker sandboxes.
 * Reuses the integration DB/app bootstrap; adds worker lifecycle and waits.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const { before, after, beforeEach } = require('node:test');
const { Worker } = require('bullmq');
const Docker = require('dockerode');

const {
  setupIntegration,
  resetDatabase,
  teardownIntegration,
  query,
} = require('../../integration/helpers/setup');
const { getRedis } = require('../../../src/infrastructure');
const {
  SUBMISSIONS_QUEUE_NAME,
  getSubmissionsQueue,
  closeSubmissionsQueue,
} = require('../../../src/infrastructure/queue/queues');
const { processJob } = require('../../../src/workers/judge.worker');
const { LANGUAGE_IMAGES } = require('../../../src/modules/judge/judge.pipeline');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const IMAGE_DIRS = {
  'judgex-python': path.join(REPO_ROOT, 'docker', 'images', 'python'),
  'judgex-cpp': path.join(REPO_ROOT, 'docker', 'images', 'cpp'),
};

let available = false;
let skipReason = 'not initialized';
let worker = null;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function dockerAvailable() {
  try {
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch (err) {
    return false;
  }
}

async function imageExists(name) {
  const docker = new Docker();
  try {
    await docker.getImage(name).inspect();
    return true;
  } catch {
    return false;
  }
}

function buildImage(name, contextDir) {
  const result = spawnSync(
    'docker',
    ['build', '-t', name, contextDir],
    { stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to build sandbox image ${name}`);
  }
}

async function ensureSandboxImages() {
  for (const name of Object.values(LANGUAGE_IMAGES)) {
    if (await imageExists(name)) continue;
    const dir = IMAGE_DIRS[name];
    if (!dir) throw new Error(`No Dockerfile mapping for image ${name}`);
    // eslint-disable-next-line no-console
    console.warn(`[e2e] Building missing sandbox image: ${name}`);
    buildImage(name, dir);
  }
}

async function drainJudgeQueue() {
  const queue = getSubmissionsQueue();
  await queue.drain(true);
}

async function startJudgeWorker() {
  worker = new Worker(SUBMISSIONS_QUEUE_NAME, processJob, {
    connection: getRedis(),
    concurrency: 1,
  });
  await worker.waitUntilReady();
}

async function stopJudgeWorker() {
  if (!worker) return;
  const closing = worker;
  worker = null;
  await closing.close();
}

/**
 * Poll Postgres until the submission reaches a terminal status.
 * @returns {Promise<object>} the submissions row.
 */
async function waitForTerminalSubmission(submissionId, { timeoutMs = 90000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await query(
      `SELECT id, status, verdict, compile_output, runtime_ms, memory_kb,
              failed_test_index, judged_at
       FROM submissions WHERE id = $1`,
      [submissionId],
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`Submission ${submissionId} disappeared while waiting for verdict`);
    }
    if (row.status === 'completed' || row.status === 'error') {
      return row;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for submission ${submissionId} to finish judging`,
  );
}

/**
 * Wait until the BullMQ job for this submission reaches the completed state.
 * Postgres can finalize slightly before BullMQ flips the job off `active`.
 */
async function assertJobCompleted(submissionId, { timeoutMs = 15000, intervalMs = 50 } = {}) {
  const queue = getSubmissionsQueue();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await queue.getJob(submissionId);
    if (!job) {
      throw new Error(`No BullMQ job found for submission ${submissionId}`);
    }
    const state = await job.getState();
    if (state === 'completed') {
      if (!job.finishedOn) {
        throw new Error(`Job ${submissionId} has no finishedOn timestamp`);
      }
      return { job, state, returnvalue: job.returnvalue };
    }
    if (state === 'failed') {
      throw new Error(`Job ${submissionId} failed: ${job.failedReason || 'unknown'}`);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for BullMQ job ${submissionId} to complete`);
}

function registerE2eHooks() {
  before(async () => {
    if (!(await dockerAvailable())) {
      skipReason = 'Docker daemon unreachable';
      available = false;
      // eslint-disable-next-line no-console
      console.warn(`[e2e] Skipping — ${skipReason}`);
      return;
    }

    const result = await setupIntegration();
    if (!result.available) {
      skipReason = result.reason || 'infrastructure unavailable';
      available = false;
      // eslint-disable-next-line no-console
      console.warn(`[e2e] Skipping — ${skipReason}`);
      return;
    }

    try {
      await ensureSandboxImages();
      await drainJudgeQueue();
      await startJudgeWorker();
      available = true;
    } catch (err) {
      skipReason = err.message;
      available = false;
      // eslint-disable-next-line no-console
      console.warn(`[e2e] Skipping — ${skipReason}`);
      try {
        await stopJudgeWorker();
        await closeSubmissionsQueue();
        await teardownIntegration();
      } catch {
        /* ignore */
      }
    }
  });

  beforeEach(async () => {
    if (available) {
      await resetDatabase();
    }
  });

  after(async () => {
    try {
      await stopJudgeWorker();
      await closeSubmissionsQueue();
    } catch {
      /* ignore */
    }
    await teardownIntegration();
  });

  function requireE2e(t) {
    if (!available) {
      t.skip(`E2E prerequisites unavailable: ${skipReason}`);
      return false;
    }
    return true;
  }

  return { requireE2e, isAvailable: () => available };
}

module.exports = {
  registerE2eHooks,
  waitForTerminalSubmission,
  assertJobCompleted,
  query,
  LANGUAGE_IMAGES,
};
