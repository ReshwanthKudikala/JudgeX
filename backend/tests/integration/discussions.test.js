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

describe('Discussions', () => {
  it('supports create, list, nested comments, ownership, and soft delete', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const author = await createUser();
    const other = await createUser();
    const slug = unique('disc-prob');

    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug,
      title: 'Discussion Problem',
    });
    assert.equal(problemRes.status, 201);

    const created = await api()
      .post(`/api/v1/problems/${slug}/discussions`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({
        title: 'Approach with hashmap',
        body: '## Idea\n\nUse a `Map`.\n\n```python\n# sketch\n```\n',
        tags: ['approach', 'hashmap'],
      });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.title, 'Approach with hashmap');
    assert.deepEqual(created.body.data.tags, ['approach', 'hashmap']);
    assert.equal(created.body.data.author.username, author.user.username);

    const list = await api()
      .get(`/api/v1/problems/${slug}/discussions`)
      .query({ sort: 'newest', tag: 'hashmap' });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.meta.pagination.total, 1);

    const discussionId = created.body.data.id;

    const comment = await api()
      .post(`/api/v1/discussions/${discussionId}/comments`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ body: 'Nice approach!' });
    assert.equal(comment.status, 201);

    const reply = await api()
      .post(`/api/v1/discussions/${discussionId}/comments`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({
        body: 'Thanks — watch for collisions.',
        parentCommentId: comment.body.data.id,
      });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.data.parentCommentId, comment.body.data.id);

    const detail = await api().get(`/api/v1/discussions/${discussionId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.commentCount, 2);
    assert.equal(detail.body.data.comments.length, 1);
    assert.equal(detail.body.data.comments[0].replies.length, 1);

    const forbiddenEdit = await api()
      .patch(`/api/v1/discussions/${discussionId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ title: 'Hijacked' });
    assert.equal(forbiddenEdit.status, 403);

    const edit = await api()
      .patch(`/api/v1/discussions/${discussionId}`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ title: 'Hash map approach' });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.title, 'Hash map approach');

    const report = await api()
      .post(`/api/v1/discussions/${discussionId}/report`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ reason: 'Off-topic spam content' });
    assert.equal(report.status, 201);
    assert.equal(report.body.data.status, 'open');

    const adminDeleteComment = await api()
      .delete(`/api/v1/comments/${comment.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(adminDeleteComment.status, 200);

    const afterSoftDelete = await api().get(`/api/v1/discussions/${discussionId}`);
    assert.equal(afterSoftDelete.status, 200);
    assert.equal(afterSoftDelete.body.data.comments[0].isDeleted, true);
    assert.equal(afterSoftDelete.body.data.comments[0].body, '[deleted]');

    const del = await api()
      .delete(`/api/v1/discussions/${discussionId}`)
      .set('Authorization', `Bearer ${author.accessToken}`);
    assert.equal(del.status, 200);

    const gone = await api().get(`/api/v1/discussions/${discussionId}`);
    assert.equal(gone.status, 404);
  });
});
