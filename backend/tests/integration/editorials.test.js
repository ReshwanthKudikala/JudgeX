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

describe('Editorials', () => {
  it('admin CRUD and public published editorial by slug', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const slug = unique('ed-prob');
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug,
      title: 'Editorial Problem',
    });
    const problemId = problemRes.body.data.id;

    const unpublished = await api()
      .get(`/api/v1/problems/${slug}/editorial`);
    assert.equal(unpublished.status, 404);

    const create = await api()
      .post(`/api/v1/admin/problems/${problemId}/editorial`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Approach Guide',
        markdown: '# Hint\n\nUse a **hash map**.\n\n```python\n# sketch\n```\n',
        difficulty: 'medium',
        published: false,
      });

    assert.equal(create.status, 201);
    assert.equal(create.body.data.published, false);
    assert.equal(create.body.data.title, 'Approach Guide');

    const stillHidden = await api().get(`/api/v1/problems/${slug}/editorial`);
    assert.equal(stillHidden.status, 404);

    const publish = await api()
      .patch(`/api/v1/admin/editorials/${create.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ published: true });

    assert.equal(publish.status, 200);
    assert.equal(publish.body.data.published, true);

    const publicGet = await api().get(`/api/v1/problems/${slug}/editorial`);
    assert.equal(publicGet.status, 200);
    assert.equal(publicGet.body.data.title, 'Approach Guide');
    assert.ok(publicGet.body.data.markdown.includes('hash map'));
    assert.ok(publicGet.body.data.updatedAt);

    const adminGet = await api()
      .get(`/api/v1/admin/editorials/${create.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(adminGet.status, 200);
    assert.equal(adminGet.body.data.problemId, problemId);

    const user = await createUser();
    const forbidden = await api()
      .post(`/api/v1/admin/problems/${problemId}/editorial`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'Nope',
        markdown: 'x',
      });
    assert.equal(forbidden.status, 403);

    const del = await api()
      .delete(`/api/v1/admin/editorials/${create.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(del.status, 200);

    const gone = await api().get(`/api/v1/problems/${slug}/editorial`);
    assert.equal(gone.status, 404);
  });
});
