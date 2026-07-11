const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const {
  api,
  createAdmin,
  createUser,
  createPublishedProblem,
  seedJudgedSubmission,
  unique,
} = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

function windowAroundNow({ startOffsetMin, endOffsetMin }) {
  const start = new Date(Date.now() + startOffsetMin * 60_000);
  const end = new Date(Date.now() + endOffsetMin * 60_000);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

describe('Contests', () => {
  it('admin creates a contest and public list returns it', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('c-prob'),
    });

    const { startTime, endTime } = windowAroundNow({
      startOffsetMin: 60,
      endOffsetMin: 180,
    });

    const create = await api()
      .post('/api/v1/admin/contests')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Weekly #1',
        description: 'First contest',
        startTime,
        endTime,
        problems: [{ problemId: problemRes.body.data.id, points: 100, displayOrder: 0 }],
      });

    assert.equal(create.status, 201);
    assert.equal(create.body.data.title, 'Weekly #1');
    assert.equal(create.body.data.status, 'upcoming');
    assert.equal(create.body.data.problems.length, 1);

    const list = await api().get('/api/v1/contests').query({ status: 'upcoming' });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((c) => c.id === create.body.data.id));
  });

  it('hides problems before start; allows join and problems while running', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('c-run'),
      title: 'Contest Sum',
    });

    const { startTime, endTime } = windowAroundNow({
      startOffsetMin: -10,
      endOffsetMin: 120,
    });

    const created = await api()
      .post('/api/v1/admin/contests')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Running Contest',
        startTime,
        endTime,
        problems: [{ problemId: problemRes.body.data.id, points: 100 }],
      });
    const contestId = created.body.data.id;
    assert.equal(created.body.data.status, 'running');

    const beforeJoin = await api().get(`/api/v1/contests/${contestId}/problems`);
    assert.equal(beforeJoin.status, 403);

    const join = await api()
      .post(`/api/v1/contests/${contestId}/join`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.ok([200, 201].includes(join.status));

    const problems = await api()
      .get(`/api/v1/contests/${contestId}/problems`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.equal(problems.status, 200);
    assert.equal(problems.body.data.problems.length, 1);
    assert.equal(problems.body.data.problems[0].title, 'Contest Sum');
  });

  it('hides problem details for upcoming contests', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('c-up'),
    });

    const { startTime, endTime } = windowAroundNow({
      startOffsetMin: 30,
      endOffsetMin: 90,
    });

    const created = await api()
      .post('/api/v1/admin/contests')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Upcoming',
        startTime,
        endTime,
        problems: [{ problemId: problemRes.body.data.id }],
      });

    await api()
      .post(`/api/v1/contests/${created.body.data.id}/join`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    const problems = await api()
      .get(`/api/v1/contests/${created.body.data.id}/problems`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.equal(problems.status, 200);
    assert.equal(problems.body.data.hidden, true);
    assert.equal(problems.body.data.problems.length, 0);
  });

  it('builds a scoreboard from contest-window submissions', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const alice = await createUser();
    const bob = await createUser();
    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('c-sb'),
    });
    const problemId = problemRes.body.data.id;

    const start = new Date(Date.now() - 60 * 60_000);
    const end = new Date(Date.now() + 60 * 60_000);

    const created = await api()
      .post('/api/v1/admin/contests')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Scoreboard Contest',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        problems: [{ problemId }],
      });
    const contestId = created.body.data.id;

    await api()
      .post(`/api/v1/contests/${contestId}/join`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    await api()
      .post(`/api/v1/contests/${contestId}/join`)
      .set('Authorization', `Bearer ${bob.accessToken}`);

    await seedJudgedSubmission(alice.user.id, problemId, {
      verdict: 'accepted',
      submittedAt: new Date(start.getTime() + 10 * 60_000).toISOString(),
    });
    await seedJudgedSubmission(bob.user.id, problemId, {
      verdict: 'wrong_answer',
      submittedAt: new Date(start.getTime() + 5 * 60_000).toISOString(),
    });
    await seedJudgedSubmission(bob.user.id, problemId, {
      verdict: 'accepted',
      submittedAt: new Date(start.getTime() + 20 * 60_000).toISOString(),
    });

    const board = await api().get(`/api/v1/contests/${contestId}/scoreboard`);
    assert.equal(board.status, 200);
    assert.ok(board.body.meta.participantCount >= 2);
    assert.ok(Array.isArray(board.body.data));
    assert.ok(board.body.data.length >= 2);

    const aliceRow = board.body.data.find((e) => e.userId === alice.user.id);
    const bobRow = board.body.data.find((e) => e.userId === bob.user.id);
    assert.ok(aliceRow);
    assert.ok(bobRow);
    assert.equal(aliceRow.solved, 1);
    assert.equal(bobRow.solved, 1);
    // Alice finished faster with no wrongs → better (lower) rank than Bob.
    assert.ok(aliceRow.rank < bobRow.rank);
  });
});
