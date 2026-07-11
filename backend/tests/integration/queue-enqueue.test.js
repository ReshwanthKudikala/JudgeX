const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { createAdmin, createUser, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { SubmissionService } = require('../../src/modules/submissions/submissions.service');
const { QueueError } = require('../../src/shared/errors/domain-errors');

const { requireInfra } = registerSuiteHooks();

describe('Queue integration (persist-before-enqueue)', () => {
  it('persists the submission before enqueue and calls enqueue exactly once', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('enq-ok'),
    });
    const problemId = problemRes.body.data.id;

    const enqueueCalls = [];
    const svc = new SubmissionService({
      enqueueSubmission: async (submissionId) => {
        // At enqueue time the row must already be committed and visible.
        const { rows } = await query(
          `SELECT id, status FROM submissions WHERE id = $1`,
          [submissionId],
        );
        enqueueCalls.push({
          submissionId,
          dbRow: rows[0] || null,
        });
        return { id: submissionId };
      },
    });

    const submission = await svc.createSubmission({
      userId: user.user.id,
      problemId,
      language: 'cpp',
      sourceCode: 'int main(){return 0;}',
    });

    assert.equal(submission.status, 'queued');
    assert.equal(enqueueCalls.length, 1, 'enqueue must be called exactly once');
    assert.equal(enqueueCalls[0].submissionId, submission.id);
    assert.ok(enqueueCalls[0].dbRow, 'submission must be visible in Postgres before enqueue');
    assert.equal(enqueueCalls[0].dbRow.status, 'queued');

    const { rows } = await query(`SELECT status FROM submissions WHERE id = $1`, [submission.id]);
    assert.equal(rows[0].status, 'queued');
  });

  it('leaves the submission queued and throws QueueError when enqueue fails', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('enq-fail'),
    });
    const problemId = problemRes.body.data.id;

    let enqueueCalls = 0;
    const svc = new SubmissionService({
      enqueueSubmission: async () => {
        enqueueCalls += 1;
        throw new QueueError('Failed to enqueue submission for judging.', {
          cause: 'simulated redis failure',
        });
      },
    });

    let caught = null;
    try {
      await svc.createSubmission({
        userId: user.user.id,
        problemId,
        language: 'python',
        sourceCode: 'print(1)',
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, 'createSubmission must throw when enqueue fails');
    assert.equal(caught instanceof QueueError, true);
    assert.equal(caught.code, 'SERVICE_UNAVAILABLE');
    assert.equal(caught.statusCode, 503);
    assert.equal(enqueueCalls, 1);

    // Row must still exist in queued state (never deleted, never retried here).
    const { rows } = await query(
      `SELECT id, status FROM submissions WHERE user_id = $1 AND problem_id = $2`,
      [user.user.id, problemId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'queued');
  });

  it('returns QueueError (503) through the HTTP API when enqueue fails', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('enq-http'),
    });
    const problemId = problemRes.body.data.id;

    // Swap the singleton's enqueue for this test only.
    const { submissionService } = require('../../src/modules/submissions/submissions.service');
    const { api } = require('./helpers/fixtures');
    const original = submissionService.enqueueSubmission;
    submissionService.enqueueSubmission = async () => {
      throw new QueueError('Failed to enqueue submission for judging.', {
        cause: 'simulated redis failure',
      });
    };

    try {
      const res = await api()
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          problemId,
          language: 'cpp',
          sourceCode: 'int main(){return 0;}',
        });

      assert.equal(res.status, 503);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SERVICE_UNAVAILABLE');

      const { rows } = await query(
        `SELECT status FROM submissions WHERE user_id = $1 AND problem_id = $2`,
        [user.user.id, problemId],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'queued');
    } finally {
      submissionService.enqueueSubmission = original;
    }
  });
});
