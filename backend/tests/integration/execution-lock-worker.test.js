const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const { acquireSubmissionExecutionLock } = require('../../src/modules/judge/execution-lock');
const { processSubmissionJob } = require('../../src/workers/judge.worker');

const { requireInfra } = registerSuiteHooks();

const PROBE_QUEUE = 'judgex-lock-probe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRedis() {
  return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
}

async function assertIsolated() {
  const { rows } = await query('SELECT current_database() AS db');
  if (rows[0].db === 'judgex' && process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Refusing BullMQ lock test against database judgex outside GitHub Actions.');
  }
  const redisUrl = process.env.REDIS_URL || '';
  let redisDb = '';
  try {
    redisDb = new URL(redisUrl).pathname;
  } catch {
    redisDb = '';
  }
  if (redisDb !== '/15' && process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Refusing BullMQ lock test unless REDIS_URL selects database 15.');
  }
}

describe('BullMQ worker execution lock', () => {
  it('delays a real duplicate delivery without consuming an attempt', { timeout: 20000 }, async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('lock-worker'),
    });
    const svc = new SubmissionService({ enqueueSubmission: async () => ({ id: 'noop' }) });
    const submission = await svc.createSubmission({
      userId: user.user.id,
      problemId: problemRes.body.data.id,
      language: 'python',
      sourceCode: 'print(1)',
    });

    let inFlight = 0;
    let maxInFlight = 0;
    let pipelineCalls = 0;
    let releaseHolder;
    const holderEntered = new Promise((resolve) => {
      releaseHolder = resolve;
    });
    const deps = {
      submissions: svc,
      acquireExecutionLock: acquireSubmissionExecutionLock,
      invalidateLeaderboardCache: async () => {},
      runPipeline: async () => {
        pipelineCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        if (pipelineCalls === 1) await holderEntered;
        inFlight -= 1;
        return { verdict: 'accepted' };
      },
    };

    const queueConn = createRedis();
    const workerConn = createRedis();
    const queue = new Queue(PROBE_QUEUE, { connection: queueConn });
    const failures = [];
    const completed = new Map();
    const worker = new Worker(
      PROBE_QUEUE,
      async (job) => processSubmissionJob(job, deps),
      { connection: workerConn, concurrency: 2, lockDuration: 30_000 },
    );
    worker.on('failed', (job, err) => {
      failures.push({ id: job && job.id, message: err && err.message });
    });
    worker.on('completed', (job, result) => {
      completed.set(String(job.id), result);
    });

    const firstId = `${submission.id}-a`;
    const secondId = `${submission.id}-b`;
    const payload = {
      submissionId: submission.id,
      schemaVersion: 1,
      enqueuedAt: new Date().toISOString(),
    };
    const jobOpts = { attempts: 3, removeOnComplete: false, removeOnFail: false };

    try {
      await worker.waitUntilReady();
      await queue.add('judge-submission', payload, { jobId: firstId, ...jobOpts });
      await queue.add('judge-submission', payload, { jobId: secondId, ...jobOpts });

      let delayedSnapshot = null;
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !delayedSnapshot) {
        const left = await queue.getJob(firstId);
        const right = await queue.getJob(secondId);
        const pair = [left, right].filter(Boolean);
        const delayed = [];
        for (const job of pair) {
          if ((await job.getState()) === 'delayed') delayed.push(job);
        }
        if (delayed.length === 1 && pipelineCalls === 1) {
          delayedSnapshot = {
            id: delayed[0].id,
            attemptsMade: delayed[0].attemptsMade,
            attempts: delayed[0].opts.attempts,
          };
        }
        await sleep(40);
      }
      assert.ok(delayedSnapshot, 'expected one real BullMQ job to be delayed while the other holds the lock');
      assert.equal(delayedSnapshot.attemptsMade, 0);
      assert.equal(delayedSnapshot.attempts, 3);
      assert.equal(maxInFlight, 1);
      assert.equal(failures.length, 0);

      releaseHolder();

      const doneDeadline = Date.now() + 10000;
      while (Date.now() < doneDeadline && completed.size < 2) {
        await sleep(50);
      }
      assert.equal(completed.size, 2);
      assert.equal(pipelineCalls, 2);
      assert.equal(maxInFlight, 1);
      assert.equal(failures.length, 0);

      const delayedAfter = await queue.getJob(delayedSnapshot.id);
      assert.equal(await delayedAfter.getState(), 'completed');
      assert.equal(delayedAfter.attemptsMade, 1);

      await svc.completeSubmission(submission.id, {
        verdict: 'accepted',
        runtimeMs: 1,
        memoryKb: 1,
        failedTestIndex: null,
        passedTests: 1,
        totalTests: 1,
        testResults: [],
      });
      const thirdId = `${submission.id}-c`;
      await queue.add('judge-submission', payload, { jobId: thirdId, ...jobOpts });
      const thirdDeadline = Date.now() + 8000;
      while (Date.now() < thirdDeadline && !completed.has(thirdId)) {
        await sleep(40);
      }
      assert.equal(completed.get(thirdId) && completed.get(thirdId).skipped, true);
      assert.equal(pipelineCalls, 2);

      const { rows } = await query(
        `SELECT s.status, s.verdict, p.total_submissions, p.total_accepted
           FROM submissions s
           JOIN problems p ON p.id = s.problem_id
          WHERE s.id = $1`,
        [submission.id],
      );
      assert.equal(rows[0].status, 'completed');
      assert.equal(rows[0].verdict, 'accepted');
      assert.equal(Number(rows[0].total_submissions), 1);
      assert.equal(Number(rows[0].total_accepted), 1);
    } finally {
      releaseHolder();
      await worker.close().catch(() => {});
      await queue.obliterate({ force: true }).catch(() => {});
      await queue.close().catch(() => {});
      queueConn.disconnect();
      workerConn.disconnect();
    }
  });
});
