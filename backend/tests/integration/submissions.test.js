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
    assert.ok(res.body.data.problem);
    assert.equal(res.body.data.problem.id, problemRes.body.data.id);
  });

  it('forbids non-owners from reading another user submission', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const owner = await createUser();
    const other = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('forbid'),
    });

    const created = await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        problemId: problemRes.body.data.id,
        language: 'python',
        sourceCode: 'print(1)',
      });

    const res = await api()
      .get(`/api/v1/submissions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    assert.equal(res.status, 403);
  });

  it('filters submissions by problemId and returns problem summaries', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: a } = await createPublishedProblem(admin.accessToken, {
      slug: unique('filt-a'),
      title: 'Alpha Filter',
    });
    const { res: b } = await createPublishedProblem(admin.accessToken, {
      slug: unique('filt-b'),
      title: 'Beta Filter',
    });

    await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ problemId: a.body.data.id, language: 'cpp', sourceCode: 'a' });
    await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ problemId: b.body.data.id, language: 'python', sourceCode: 'b' });

    const res = await api()
      .get('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .query({ problemId: a.body.data.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].problemId, a.body.data.id);
    assert.equal(res.body.data[0].problem.title, 'Alpha Filter');
  });

  it('returns progress stats for the current user', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('prog'),
    });

    await api()
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        problemId: problemRes.body.data.id,
        language: 'python',
        sourceCode: 'print(1)',
      });

    const res = await api()
      .get('/api/v1/submissions/stats')
      .set('Authorization', `Bearer ${user.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.totalSubmissions, 1);
    assert.ok(Array.isArray(res.body.data.recentSubmissions));
    assert.ok(Array.isArray(res.body.data.recentAcceptedProblems));
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
