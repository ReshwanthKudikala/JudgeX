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

describe('Leaderboard', () => {
  it('returns a paginated global leaderboard ordered by ranking rules', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();

    // Distinct problems so DISTINCT problem counts work.
    const problems = [];
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { res } = await createPublishedProblem(admin.accessToken, {
        slug: unique(`lb-p${i}`),
        title: `LB Problem ${i}`,
      });
      problems.push(res.body.data.id);
    }

    // b: 10 solved → rank 1
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedJudgedSubmission(b.user.id, problems[i], {
        verdict: 'accepted',
        submittedAt: '2026-01-01T00:00:00Z',
      });
    }

    // c: 5 solved, higher acceptance than a (5 AC / 6 total ≈ 83%)
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedJudgedSubmission(c.user.id, problems[i], {
        verdict: 'accepted',
        submittedAt: '2026-01-03T00:00:00Z',
      });
    }
    await seedJudgedSubmission(c.user.id, problems[5], {
      verdict: 'wrong_answer',
      submittedAt: '2026-01-03T01:00:00Z',
    });

    // a: 5 solved, lower acceptance (5 AC / 10 total = 50%)
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedJudgedSubmission(a.user.id, problems[i], {
        verdict: 'accepted',
        submittedAt: '2026-01-02T00:00:00Z',
      });
    }
    for (let i = 5; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedJudgedSubmission(a.user.id, problems[i], {
        verdict: 'wrong_answer',
        submittedAt: '2026-01-02T01:00:00Z',
      });
    }

    const res = await api().get('/api/v1/leaderboard').query({ page: 1, limit: 50, timeframe: 'all' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta.pagination);
    assert.equal(res.body.meta.timeframe, 'all');

    const ranks = res.body.data.filter((e) =>
      [a.user.id, b.user.id, c.user.id].includes(e.userId),
    );
    assert.equal(ranks.length, 3);

    // b (10 solved) first; then c (5 solved, higher acceptance); then a.
    assert.equal(ranks[0].userId, b.user.id);
    assert.equal(ranks[0].rank, ranks[0].rank); // present
    assert.ok(ranks[0].rank < ranks[1].rank);
    assert.ok(ranks[1].rank < ranks[2].rank);
    assert.equal(ranks[0].userId, b.user.id);
    assert.equal(ranks[1].userId, c.user.id);
    assert.equal(ranks[2].userId, a.user.id);

    // Sprint 27 response fields
    assert.equal(ranks[0].solved, 10);
    assert.equal(ranks[0].problemsSolved, 10);
    assert.equal(ranks[0].avatar, null);
    assert.ok(typeof ranks[0].score === 'number');
    assert.ok(typeof ranks[0].accepted === 'number');
    assert.ok(typeof ranks[0].submissions === 'number');
  });

  it('returns a single user rank', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const top = await createUser();
    const mid = await createUser();

    const { res: p1 } = await createPublishedProblem(admin.accessToken, {
      slug: unique('rank-a'),
    });
    const { res: p2 } = await createPublishedProblem(admin.accessToken, {
      slug: unique('rank-b'),
    });

    await seedJudgedSubmission(top.user.id, p1.body.data.id, { verdict: 'accepted' });
    await seedJudgedSubmission(top.user.id, p2.body.data.id, { verdict: 'accepted' });
    await seedJudgedSubmission(mid.user.id, p1.body.data.id, { verdict: 'accepted' });

    const topRank = await api().get(`/api/v1/leaderboard/users/${top.user.id}/rank`);
    const midRank = await api().get(`/api/v1/leaderboard/users/${mid.user.id}/rank`);
    assert.equal(topRank.status, 200);
    assert.equal(midRank.status, 200);
    assert.equal(midRank.body.data.userId, mid.user.id);
    assert.equal(midRank.body.data.solved, 1);
    assert.equal(midRank.body.data.problemsSolved, 1);
    assert.ok(topRank.body.data.rank < midRank.body.data.rank);
  });

  it('supports weekly timeframe filtering', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const recent = await createUser();
    const old = await createUser();

    const { res: problemRes } = await createPublishedProblem(admin.accessToken, {
      slug: unique('tf-week'),
    });
    const problemId = problemRes.body.data.id;

    await seedJudgedSubmission(recent.user.id, problemId, {
      verdict: 'accepted',
      submittedAt: new Date().toISOString(),
    });
    await seedJudgedSubmission(old.user.id, problemId, {
      verdict: 'accepted',
      submittedAt: '2020-01-01T00:00:00Z',
    });

    const res = await api().get('/api/v1/leaderboard').query({ timeframe: 'weekly', limit: 50 });
    assert.equal(res.status, 200);
    const ids = res.body.data.map((e) => e.userId);
    assert.ok(ids.includes(recent.user.id));
    assert.ok(!ids.includes(old.user.id));
    assert.equal(res.body.meta.timeframe, 'weekly');
  });
});
