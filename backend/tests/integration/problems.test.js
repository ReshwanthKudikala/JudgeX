const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, createAdmin, createPublishedProblem, unique } = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

describe('Problems API', () => {
  it('lists problems', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    await createPublishedProblem(admin.accessToken, { slug: unique('list-a'), title: 'A' });
    await createPublishedProblem(admin.accessToken, { slug: unique('list-b'), title: 'B' });

    const res = await api().get('/api/v1/problems').query({ limit: 10 });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);
    assert.ok(res.body.meta.pagination);
    assert.equal(res.body.meta.pagination.total >= 2, true);
  });

  it('returns problem detail by slug', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const slug = unique('detail');
    const { res: createRes } = await createPublishedProblem(admin.accessToken, {
      slug,
      title: 'Detail Problem',
      statement: 'Read me.',
    });
    assert.equal(createRes.status, 201);

    const res = await api().get(`/api/v1/problems/${slug}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.slug, slug);
    assert.equal(res.body.data.title, 'Detail Problem');
    assert.equal(res.body.data.statement, 'Read me.');
    assert.ok(Array.isArray(res.body.data.examples));
    assert.equal(res.body.data.examples.length, 0);
  });

  it('returns public sample examples on problem detail (hidden cases excluded)', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const slug = unique('detail-ex');
    const { res: createRes } = await createPublishedProblem(admin.accessToken, {
      slug,
      title: 'With Samples',
      statement: 'Samples.',
    });
    const problemId = createRes.body.data.id;

    await api()
      .put(`/api/v1/admin/problems/${problemId}/testcases`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        testCases: [
          {
            input: '1 2',
            expectedOutput: '3',
            isSample: true,
            explanation: '1+2=3',
            order: 0,
          },
          { input: '9 9', expectedOutput: '18', isHidden: true, order: 1 },
        ],
      })
      .expect(200);

    const res = await api().get(`/api/v1/problems/${slug}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.examples.length, 1);
    assert.equal(res.body.data.examples[0].input, '1 2');
    assert.equal(res.body.data.examples[0].output, '3');
    assert.equal(res.body.data.examples[0].explanation, '1+2=3');
  });

  it('returns 404 for an invalid slug', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().get('/api/v1/problems/does-not-exist-slug');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('creates a problem (admin)', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const slug = unique('create');
    const res = await api()
      .post('/api/v1/admin/problems')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        slug,
        title: 'Created',
        statement: 'Body',
        difficulty: 'medium',
        isPublished: true,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.slug, slug);
    assert.equal(res.body.data.difficulty, 'medium');
  });

  it('updates a problem (admin)', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const { res: created } = await createPublishedProblem(admin.accessToken, {
      slug: unique('upd'),
      title: 'Before',
    });
    const id = created.body.data.id;

    const res = await api()
      .patch(`/api/v1/admin/problems/${id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: 'After' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'After');
  });

  it('soft-deletes a problem (admin)', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const slug = unique('del');
    const { res: created } = await createPublishedProblem(admin.accessToken, { slug });
    const id = created.body.data.id;

    const del = await api()
      .delete(`/api/v1/admin/problems/${id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    assert.equal(del.status, 200);
    assert.equal(del.body.data.deleted, true);

    const detail = await api().get(`/api/v1/problems/${slug}`);
    assert.equal(detail.status, 404);
  });
});
