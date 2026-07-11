const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const {
  api,
  createAdmin,
  createUser,
  createPublishedProblem,
  unique,
} = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

describe('Submission flow', () => {
  it('submits code and returns 202 with a queued submission', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('sub'),
    });
    const problemId = problemRes.body.data.id;

    const res = await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        problemId,
        language: 'cpp',
        sourceCode: 'int main(){ return 0; }',
      });

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'queued');
    assert.equal(res.body.data.problemId, problemId);
    assert.equal(res.body.data.userId, user.user.id);
    assert.ok(res.body.data.id);
  });

  it('fetches a submission by id', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('fetch'),
    });

    const created = await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        problemId: problemRes.body.data.id,
        language: 'python',
        sourceCode: 'print(1)',
      });
    const submissionId = created.body.data.id;

    const res = await api()
      .get(`/api/v1/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, submissionId);
    assert.equal(res.body.data.language, 'python');
    assert.equal(res.body.data.sourceCode, 'print(1)');
  });

  it('lists the current user submissions', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('listsub'),
    });
    const problemId = problemRes.body.data.id;

    await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ problemId, language: 'cpp', sourceCode: 'a' });
    await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ problemId, language: 'python', sourceCode: 'b' });

    const res = await api()
      .get('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .query({ limit: 10 });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.meta.pagination);
    assert.equal(res.body.meta.pagination.total, 2);
  });
});
