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

describe('Admin dashboard', () => {
  it('returns overview stats for admins and forbids non-admins', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    await createPublishedProblem(admin.accessToken, { slug: unique('adm-prob') });

    const forbidden = await api()
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.equal(forbidden.status, 403);

    const dashboard = await api()
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.body.data.users.total >= 2);
    assert.ok(dashboard.body.data.problems.total >= 1);
    assert.ok(dashboard.body.data.queue);
    assert.ok(dashboard.body.data.worker);
  });

  it('lists users and supports suspend / promote actions with audit logs', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const target = await createUser();

    const list = await api()
      .get('/api/v1/admin/users')
      .query({ username: target.username })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((u) => u.id === target.user.id));

    const suspend = await api()
      .post(`/api/v1/admin/users/${target.user.id}/suspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(suspend.status, 200);
    assert.equal(suspend.body.data.status, 'suspended');

    const promote = await api()
      .post(`/api/v1/admin/users/${target.user.id}/promote`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(promote.status, 200);
    assert.equal(promote.body.data.role, 'admin');

    const unsuspend = await api()
      .post(`/api/v1/admin/users/${target.user.id}/unsuspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(unsuspend.status, 200);
    assert.equal(unsuspend.body.data.status, 'active');

    const logs = await api()
      .get('/api/v1/admin/audit-logs')
      .query({ q: 'user.suspend' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(logs.status, 200);
    assert.ok(logs.body.data.some((row) => row.action === 'user.suspend'));
  });

  it('supports moderation listing and bulk unpublish', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const { res } = await createPublishedProblem(admin.accessToken, {
      slug: unique('mod-prob'),
    });
    const problemId = res.body.data.id;

    const list = await api()
      .get('/api/v1/admin/moderation')
      .query({ entityType: 'problems', status: 'published' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((item) => item.id === problemId));

    const bulk = await api()
      .post('/api/v1/admin/moderation/bulk')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        entityType: 'problems',
        action: 'unpublish',
        ids: [problemId],
      });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.body.data.affected, 1);
  });

  it('returns queue status and analytics payloads', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();

    const queue = await api()
      .get('/api/v1/admin/queue')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(queue.status, 200);
    assert.equal(queue.body.data.name, 'judge');
    assert.ok(queue.body.data.counts);

    const analytics = await api()
      .get('/api/v1/admin/analytics')
      .query({ days: 7 })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(analytics.status, 200);
    assert.ok(Array.isArray(analytics.body.data.dailySubmissions));
    assert.ok(Array.isArray(analytics.body.data.languageUsage));
  });
});
