const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DelayedError } = require('bullmq');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const { acquireSubmissionExecutionLock } = require('../../src/modules/judge/execution-lock');
const { processSubmissionJob } = require('../../src/workers/judge.worker');

const { requireInfra } = registerSuiteHooks();

async function assertIsolatedDatabase() {
  const { rows } = await query('SELECT current_database() AS db');
  if (rows[0].db === 'judgex' && process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Refusing execution-lock test against database judgex outside GitHub Actions.');
  }
  return rows[0].db;
}

describe('Submission execution lock', () => {
  it('allows one holder and a later attempt after release', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolatedDatabase();

    const first = await acquireSubmissionExecutionLock('00000000-0000-7000-8000-000000000101');
    const second = await acquireSubmissionExecutionLock('00000000-0000-7000-8000-000000000101');
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    await first.release();
    const third = await acquireSubmissionExecutionLock('00000000-0000-7000-8000-000000000101');
    assert.equal(third.acquired, true);
    await third.release();
  });

  it('does not run two sandboxes for one submission, and preserves a terminal row', async (t) => {
    if (!requireInfra(t)) return;
    await assertIsolatedDatabase();

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('lock'),
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
    let unblockPipeline;
    const duplicateArrived = new Promise((resolve) => {
      unblockPipeline = resolve;
    });
    const deps = {
      submissions: svc,
      acquireExecutionLock: async (submissionId) => {
        const lock = await acquireSubmissionExecutionLock(submissionId);
        if (!lock.acquired) unblockPipeline();
        return lock;
      },
      invalidateLeaderboardCache: async () => {},
      runPipeline: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await duplicateArrived;
        inFlight -= 1;
        return { verdict: 'accepted' };
      },
    };

    const job = (id) => ({
      id,
      name: 'judge-submission',
      data: { submissionId: submission.id, schemaVersion: 1 },
      attemptsMade: 0,
      opts: { attempts: 3 },
      moveToDelayed: async () => {},
    });

    const results = await Promise.allSettled([
      processSubmissionJob(job('a'), deps),
      processSubmissionJob(job('b'), deps),
    ]);
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(maxInFlight, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DelayedError);

    await svc.completeSubmission(submission.id, {
      verdict: 'accepted',
      runtimeMs: 1,
      memoryKb: 1,
      failedTestIndex: null,
      passedTests: 1,
      totalTests: 1,
      testResults: [],
    });
    const terminal = await processSubmissionJob(job('c'), deps);
    assert.equal(terminal.skipped, true);

    const { rows } = await query(
      `SELECT status, verdict, total_submissions, total_accepted
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.id = $1`,
      [submission.id],
    );
    assert.equal(rows[0].status, 'completed');
    assert.equal(rows[0].verdict, 'accepted');
    assert.equal(Number(rows[0].total_submissions), 1);
    assert.equal(Number(rows[0].total_accepted), 1);
  });
});
