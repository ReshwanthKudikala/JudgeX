/**
 * The execution lock is a Postgres advisory lock on its own connection.
 * It ends when that connection disappears, which is what a dead worker does.
 * These tests drop that session and then run the real worker and reaper paths.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { assertConnectedDatabaseIsTest, assertRedisUrlIsDb15 } = require('./helpers/safe-target');
const { ConflictError } = require('../../src/shared/errors/http-errors');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const {
  advisoryKey,
  acquireSubmissionExecutionLock,
} = require('../../src/modules/judge/execution-lock');
const { processSubmissionJob } = require('../../src/workers/judge.worker');
const { getSubmissionsQueue } = require('../../src/infrastructure/queue/queues');
const { ReaperService } = require('../../src/modules/reaper/reaper.service');

const { requireInfra } = registerSuiteHooks();

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function assertIsolated() {
  const { rows } = await query('SELECT current_database() AS db');
  assertConnectedDatabaseIsTest(rows[0] && rows[0].db);
  assertRedisUrlIsDb15();
}

async function seedSubmission() {
  const admin = await createAdmin();
  const user = await createUser();
  const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
    slug: unique('lock-expire'),
  });
  const svc = new SubmissionService({ enqueueSubmission: async () => ({ id: 'noop' }) });
  const submission = await svc.createSubmission({
    userId: user.user.id,
    problemId: problemRes.body.data.id,
    language: 'python',
    sourceCode: 'print(1)',
  });
  return { svc, submission, userId: user.user.id };
}

async function advisoryHolderPids(submissionId) {
  const [k1, k2] = advisoryKey(submissionId);
  const { rows } = await query(
    `SELECT l.pid
       FROM pg_locks l
      WHERE l.locktype = 'advisory'
        AND l.granted
        AND l.classid = (((($1::bigint % 4294967296) + 4294967296) % 4294967296))::oid
        AND l.objid = (((($2::bigint % 4294967296) + 4294967296) % 4294967296))::oid`,
    [k1, k2],
  );
  return rows.map((row) => Number(row.pid));
}

async function terminateLockSession(submissionId) {
  const pids = await advisoryHolderPids(submissionId);
  assert.equal(pids.length, 1, `expected one advisory lock holder, saw ${pids.join(',') || 'none'}`);
  const { rows } = await query('SELECT pg_terminate_backend($1::int) AS terminated', [pids[0]]);
  assert.equal(rows[0].terminated, true);
}

function judgeJob(submissionId, id) {
  return {
    id,
    name: 'judge-submission',
    data: { submissionId, schemaVersion: 1 },
    attemptsMade: 0,
    opts: { attempts: 3 },
    token: 'lock-expiry',
    moveToDelayed: async () => {},
  };
}

const ACCEPTED = {
  verdict: 'accepted',
  runtimeMs: 4,
  memoryKb: 4,
  failedTestIndex: null,
  passedTests: 1,
  totalTests: 1,
  testResults: [],
};

async function countersFor(submissionId) {
  const { rows } = await query(
    `SELECT s.status, s.verdict, p.total_submissions, p.total_accepted
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
      WHERE s.id = $1`,
    [submissionId],
  );
  return rows[0];
}

describe('Execution lock expiry and worker recovery', () => {
  it('lets a second worker enter after the holder session dies, and finalizes once', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { svc, submission } = await seedSubmission();
    let signalEntered;
    let signalSecond;
    const entered = new Promise((resolve) => {
      signalEntered = resolve;
    });
    const secondEntered = new Promise((resolve) => {
      signalSecond = resolve;
    });
    let continueFirst;
    let continueSecond;
    const firstMayFinish = new Promise((resolve) => {
      continueFirst = resolve;
    });
    const secondMayFinish = new Promise((resolve) => {
      continueSecond = resolve;
    });
    let pipelineCalls = 0;

    const deps = {
      submissions: svc,
      acquireExecutionLock: acquireSubmissionExecutionLock,
      invalidateLeaderboardCache: async () => {},
      runPipeline: async () => {
        pipelineCalls += 1;
        if (pipelineCalls === 1) {
          signalEntered();
          await firstMayFinish;
          await svc.completeSubmission(submission.id, ACCEPTED);
          return { verdict: 'accepted' };
        }
        signalSecond();
        await secondMayFinish;
        await svc.completeSubmission(submission.id, ACCEPTED);
        return { verdict: 'accepted' };
      },
    };

    const firstJob = processSubmissionJob(judgeJob(submission.id, 'holder'), deps);
    let secondJob = Promise.resolve();
    try {
      await withTimeout(entered, 5000, 'the first pipeline to acquire the lock');
      await terminateLockSession(submission.id);

      secondJob = processSubmissionJob(judgeJob(submission.id, 'recovery'), deps);
      await withTimeout(secondEntered, 5000, 'the second worker to enter after the lock session ended');
      assert.equal(pipelineCalls, 2);

      continueFirst();
      const first = await withTimeout(firstJob, 5000, 'the original worker to finish');
      assert.equal(first.verdict, 'accepted');

      continueSecond();
      const second = await withTimeout(secondJob, 5000, 'the recovered worker to finish');
      assert.equal(second.skipped, true);
      assert.equal(pipelineCalls, 2);
    } finally {
      continueFirst();
      continueSecond();
      await firstJob.catch(() => {});
      await secondJob.catch(() => {});
    }

    const row = await countersFor(submission.id);
    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted');
    assert.equal(Number(row.total_submissions), 1);
    assert.equal(Number(row.total_accepted), 1);

    await assert.rejects(
      () => svc.completeSubmission(submission.id, ACCEPTED),
      (err) => err instanceof ConflictError,
    );
    const again = await countersFor(submission.id);
    assert.equal(Number(again.total_submissions), 1);
    assert.equal(Number(again.total_accepted), 1);
  });

  it('requeues a running submission after its worker connection disappears, then finalizes once', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolated();

    const { svc, submission } = await seedSubmission();
    await svc.markSubmissionRunning(submission.id);
    const crashed = await acquireSubmissionExecutionLock(submission.id);
    assert.equal(crashed.acquired, true);
    const blocked = await acquireSubmissionExecutionLock(submission.id);
    assert.equal(blocked.acquired, false);

    let job;
    try {
      await terminateLockSession(submission.id);
      const recovered = await acquireSubmissionExecutionLock(submission.id);
      assert.equal(recovered.acquired, true);
      await recovered.release();

      await query(
        `UPDATE submissions
            SET updated_at = now() - interval '2 hours',
                submitted_at = now() - interval '2 hours'
          WHERE id = $1`,
        [submission.id],
      );
      const summary = await new ReaperService({
        stuckThresholdMs: 0,
        runningStuckThresholdMs: 0,
      }).sweep();
      assert.equal(summary.requeued, 1);
      job = await getSubmissionsQueue().getJob(submission.id);
      assert.ok(job);

      const { rows: queued } = await query(
        `SELECT status, verdict FROM submissions WHERE id = $1`,
        [submission.id],
      );
      assert.equal(queued[0].status, 'queued');
      assert.equal(queued[0].verdict, null);

      let pipelines = 0;
      const deps = {
        submissions: svc,
        acquireExecutionLock: acquireSubmissionExecutionLock,
        invalidateLeaderboardCache: async () => {},
        runPipeline: async () => {
          pipelines += 1;
          await svc.completeSubmission(submission.id, ACCEPTED);
          return { verdict: 'accepted' };
        },
      };
      const judged = await processSubmissionJob(judgeJob(submission.id, 'after-crash'), deps);
      assert.equal(judged.verdict, 'accepted');
      const skipped = await processSubmissionJob(judgeJob(submission.id, 'after-terminal'), deps);
      assert.equal(skipped.skipped, true);
      assert.equal(pipelines, 1);
    } finally {
      await crashed.release().catch(() => {});
      if (job) await job.remove().catch(() => {});
    }

    const row = await countersFor(submission.id);
    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted');
    assert.equal(Number(row.total_submissions), 1);
    assert.equal(Number(row.total_accepted), 1);
  });
});
