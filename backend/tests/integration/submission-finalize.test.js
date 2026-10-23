const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const { ConflictError } = require('../../src/shared/errors/http-errors');

const { requireInfra } = registerSuiteHooks();

describe('Submission finalization (CAS + counters + per-case rows)', () => {
  it('persists test results and counters once; a second finalize is a no-op conflict', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('fin'),
    });
    const problemId = problemRes.body.data.id;

    const svc = new SubmissionService({
      enqueueSubmission: async (id) => ({ id }),
    });

    const submission = await svc.createSubmission({
      userId: user.user.id,
      problemId,
      language: 'python',
      sourceCode: 'print(1)',
    });

    const first = await svc.completeSubmission(submission.id, {
      verdict: 'accepted',
      runtimeMs: 5,
      memoryKb: 1024,
      failedTestIndex: null,
      passedTests: 1,
      totalTests: 1,
      testResults: [
        {
          testCaseId: null,
          testIndex: 0,
          status: 'accepted',
          runtimeMs: 5,
          memoryKb: 1024,
        },
      ],
    });
    assert.equal(first.status, 'completed');
    assert.equal(first.verdict, 'accepted');

    const { rows: resultRows } = await query(
      `SELECT test_index, status FROM submission_test_results WHERE submission_id = $1`,
      [submission.id],
    );
    assert.equal(resultRows.length, 1);
    assert.equal(resultRows[0].status, 'accepted');

    const { rows: problemRows } = await query(
      `SELECT total_submissions, total_accepted FROM problems WHERE id = $1`,
      [problemId],
    );
    assert.equal(Number(problemRows[0].total_submissions), 1);
    assert.equal(Number(problemRows[0].total_accepted), 1);

    const { rows: statsRows } = await query(
      `SELECT problems_solved, total_submissions, total_accepted FROM user_statistics WHERE user_id = $1`,
      [user.user.id],
    );
    assert.equal(statsRows.length, 1);
    assert.equal(Number(statsRows[0].problems_solved), 1);
    assert.equal(Number(statsRows[0].total_accepted), 1);

    await assert.rejects(
      () =>
        svc.completeSubmission(submission.id, {
          verdict: 'wrong_answer',
          testResults: [{ testIndex: 0, status: 'wrong_answer' }],
        }),
      ConflictError,
    );

    const { rows: problemAfter } = await query(
      `SELECT total_submissions, total_accepted FROM problems WHERE id = $1`,
      [problemId],
    );
    assert.equal(Number(problemAfter[0].total_submissions), 1);
    assert.equal(Number(problemAfter[0].total_accepted), 1);

    const { rows: still } = await query(
      `SELECT status, verdict FROM submissions WHERE id = $1`,
      [submission.id],
    );
    assert.equal(still[0].status, 'completed');
    assert.equal(still[0].verdict, 'accepted');
  });
});
