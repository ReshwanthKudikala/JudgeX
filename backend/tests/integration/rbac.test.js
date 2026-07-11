const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, createAdmin, createUser, unique } = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

const problemBody = () => ({
  slug: unique('rbac'),
  title: 'RBAC Probe',
  statement: 'Used only to exercise admin authorization.',
  difficulty: 'easy',
});

describe('RBAC (admin routes)', () => {
  it('anonymous caller receives 401', async (t) => {
    if (!requireInfra(t)) return;

    const res = await api().post('/api/v1/admin/problems').send(problemBody());
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });

  it('authenticated non-admin receives 403', async (t) => {
    if (!requireInfra(t)) return;

    const user = await createUser();
    const res = await api()
      .post('/api/v1/admin/problems')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(problemBody());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('admin receives success', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const res = await api()
      .post('/api/v1/admin/problems')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send(problemBody());

    // Create returns 201; the important assertion is that RBAC allowed the call.
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id);
  });
});
