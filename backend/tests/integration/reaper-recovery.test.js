const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('bullmq');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { assertConnectedDatabaseIsTest, assertRedisUrlIsDb15 } = require('./helpers/safe-target');
const { getRedis } = require('../../src/infrastructure');
const { SUBMISSIONS_QUEUE_NAME, getSubmissionsQueue } = require('../../src/infrastructure/queue/queues');
const { JOB_NAME } = require('../../src/infrastructure/queue/queue.service');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const { ReaperService } = require('../../src/modules/reaper/reaper.service');

const { requireInfra } = registerSuiteHooks();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertIsolated() {
  const { rows } = await query('SELECT current_database() AS db');
  assertConnectedDatabaseIsTest(rows[0] && rows[0].db);
  assertRedisUrlIsDb15();
}

async function seedUserAndProblem() {
  const admin = await createAdmin();
  const user = await createUser();
  const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
    slug: unique('reaper'),
  });
  const svc = new SubmissionService({ enqueueSubmission: async () => ({ id: 'noop' }) });
  return { user, problemId: problemRes.body.data.id, svc };
}

async function insertSubmission(svc, userId, problemId, sourceCode) {
  return svc.createSubmission({
    userId,
    problemId,
    language: 'python',
    sourceCode,
  });
}

async function backdate(id) {
  await query(
    `UPDATE submissions
        SET submitted_at = now() - interval '2 hours',
            updated_at = now() - interval '2 hours'
      WHERE id = $1`,
    [id],
  );
}

async function addJob(id, options = {}) {
  const queue = getSubmissionsQueue();
  return queue.add(
    JOB_NAME,
    {
      submissionId: id,
      schemaVersion: 1,
      enqueuedAt: new Date().toISOString(),
    },
    {
      jobId: id,
      removeOnComplete: false,
      removeOnFail: false,
      attempts: 1,
      ...options,
    },
  );
}

async function waitForState(id, wanted, timeoutMs = 10000) {
  const queue = getSubmissionsQueue();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await queue.getJob(id);
    if (job) {
      const state = await job.getState();
      if (state === wanted) return job;
    }
    await sleep(40);
  }
  throw new Error(`Timed out waiting for job ${id} to become ${wanted}`);
}

async function withWorker(processor, fn) {
  const worker = new Worker(SUBMISSIONS_QUEUE_NAME, processor, {
    connection: getRedis(),
    concurrency: 1,
  });
  try {
    await worker.waitUntilReady();
    return await fn();
  } finally {
    await worker.close();
  }
}

function reaper() {
  return new ReaperService({ stuckThresholdMs: 0, runningStuckThresholdMs: 0 });
}

describe('Reaper recovery against Postgres and Redis', () => {
  it('leaves an active job and its queued row alone', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { user, problemId, svc } = await seedUserAndProblem();
    const submission = await insertSubmission(svc, user.user.id, problemId, 'print(1)');
    await backdate(submission.id);
    await addJob(submission.id);

    const summary = await reaper().sweep();
    const job = await getSubmissionsQueue().getJob(submission.id);
    const { rows } = await query(`SELECT status FROM submissions WHERE id = $1`, [submission.id]);

    assert.equal(summary.requeued, 0);
    assert.equal(summary.finalizedError, 0);
    assert.equal(summary.alreadyEnqueued, 1);
    assert.equal(await job.getState(), 'waiting');
    assert.equal(rows[0].status, 'queued');
  });

  it('requeues a completed job once and does not loop on the next sweep', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { user, problemId, svc } = await seedUserAndProblem();
    const submission = await insertSubmission(svc, user.user.id, problemId, 'print(1)');
    await backdate(submission.id);
    await addJob(submission.id);
    await withWorker(async () => ({ ignored: true }), () => waitForState(submission.id, 'completed'));

    const first = await reaper().sweep();
    const afterFirst = await query(`SELECT status, verdict FROM submissions WHERE id = $1`, [submission.id]);
    const waiting = await getSubmissionsQueue().getJob(submission.id);
    assert.equal(first.requeued, 1);
    assert.equal(first.finalizedError, 0);
    assert.equal(afterFirst.rows[0].status, 'queued');
    assert.equal(afterFirst.rows[0].verdict, null);
    assert.equal(await waiting.getState(), 'waiting');

    const second = await reaper().sweep();
    const afterSecond = await query(`SELECT status FROM submissions WHERE id = $1`, [submission.id]);
    assert.equal(second.requeued, 0);
    assert.equal(second.alreadyEnqueued, 1);
    assert.equal(afterSecond.rows[0].status, 'queued');
    assert.equal(await (await getSubmissionsQueue().getJob(submission.id)).getState(), 'waiting');

    await withWorker(async () => ({ ignored: true }), () => waitForState(submission.id, 'completed'));
    const third = await reaper().sweep();
    const afterThird = await query(
      `SELECT status, verdict FROM submissions WHERE id = $1`,
      [submission.id],
    );
    const { rows: counters } = await query(
      `SELECT total_submissions, total_accepted FROM problems WHERE id = $1`,
      [problemId],
    );
    assert.equal(third.finalizedError, 1);
    assert.equal(third.requeued, 0);
    assert.equal(afterThird.rows[0].status, 'error');
    assert.equal(afterThird.rows[0].verdict, 'internal_error');
    assert.equal(Number(counters[0].total_submissions), 0);
    assert.equal(Number(counters[0].total_accepted), 0);

    const fourth = await reaper().sweep();
    const afterFourth = await query(`SELECT status, verdict FROM submissions WHERE id = $1`, [submission.id]);
    assert.equal(fourth.requeued, 0);
    assert.equal(fourth.finalizedError, 0);
    assert.equal(afterFourth.rows[0].status, 'error');
    assert.equal(afterFourth.rows[0].verdict, 'internal_error');
  });

  it('finalizes a failed job once and does not requeue it again', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { user, problemId, svc } = await seedUserAndProblem();
    const submission = await insertSubmission(svc, user.user.id, problemId, 'print(1)');
    await query(`UPDATE submissions SET status = 'running' WHERE id = $1`, [submission.id]);
    await backdate(submission.id);
    await addJob(submission.id);
    await withWorker(
      async () => {
        throw new Error('sandbox crashed');
      },
      () => waitForState(submission.id, 'failed'),
    );

    const first = await reaper().sweep();
    const row = await query(`SELECT status, verdict FROM submissions WHERE id = $1`, [submission.id]);
    assert.equal(first.finalizedError, 1);
    assert.equal(first.requeued, 0);
    assert.equal(row.rows[0].status, 'error');
    assert.equal(row.rows[0].verdict, 'internal_error');

    const second = await reaper().sweep();
    const again = await query(`SELECT status, verdict FROM submissions WHERE id = $1`, [submission.id]);
    assert.equal(second.requeued, 0);
    assert.equal(second.finalizedError, 0);
    assert.equal(again.rows[0].status, 'error');
    assert.equal(again.rows[0].verdict, 'internal_error');
  });

  it('does not overwrite an accepted verdict or its counters', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { user, problemId, svc } = await seedUserAndProblem();
    const submission = await insertSubmission(svc, user.user.id, problemId, 'print(1)');
    await svc.completeSubmission(submission.id, {
      verdict: 'accepted',
      runtimeMs: 2,
      memoryKb: 2,
      failedTestIndex: null,
      passedTests: 1,
      totalTests: 1,
      testResults: [],
    });
    await addJob(submission.id);
    await withWorker(async () => ({ ignored: true }), () => waitForState(submission.id, 'completed'));
    await backdate(submission.id);

    const summary = await reaper().sweep();
    const { rows } = await query(
      `SELECT s.status, s.verdict, p.total_submissions, p.total_accepted
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.id = $1`,
      [submission.id],
    );
    assert.equal(summary.requeued, 0);
    assert.equal(summary.finalizedError, 0);
    assert.equal(rows[0].status, 'completed');
    assert.equal(rows[0].verdict, 'accepted');
    assert.equal(Number(rows[0].total_submissions), 1);
    assert.equal(Number(rows[0].total_accepted), 1);
  });

  it('requeues a stuck running row when its job is gone', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { user, problemId, svc } = await seedUserAndProblem();
    const submission = await insertSubmission(svc, user.user.id, problemId, 'print(1)');
    await query(`UPDATE submissions SET status = 'running' WHERE id = $1`, [submission.id]);
    await backdate(submission.id);

    const summary = await reaper().sweep();
    const { rows } = await query(`SELECT status, verdict FROM submissions WHERE id = $1`, [submission.id]);
    const job = await getSubmissionsQueue().getJob(submission.id);
    assert.equal(summary.requeued, 1);
    assert.equal(rows[0].status, 'queued');
    assert.equal(rows[0].verdict, null);
    assert.ok(job);
    assert.equal(await job.getState(), 'waiting');
    await job.remove();
  });
});
