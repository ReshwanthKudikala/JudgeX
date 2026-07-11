const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, createUser, seedUserStatistics } = require('./helpers/fixtures');

const { requireInfra } = registerSuiteHooks();

describe('Leaderboard', () => {
  it('returns a paginated global leaderboard ordered by ranking rules', async (t) => {
    if (!requireInfra(t)) return;

    const a = await createUser();
    const b = await createUser();
    const c = await createUser();

    // Ranking: problems_solved DESC, acceptance_rate DESC, last_solved_at ASC, created_at ASC
    await seedUserStatistics(a.user.id, {
      problemsSolved: 5,
      totalSubmissions: 10,
      totalAccepted: 5,
      acceptanceRate: 50,
      lastSolvedAt: '2026-01-02T00:00:00Z',
    });
    await seedUserStatistics(b.user.id, {
      problemsSolved: 10,
      totalSubmissions: 12,
      totalAccepted: 10,
      acceptanceRate: 83.33,
      lastSolvedAt: '2026-01-01T00:00:00Z',
    });
    await seedUserStatistics(c.user.id, {
      problemsSolved: 5,
      totalSubmissions: 6,
      totalAccepted: 5,
      acceptanceRate: 90,
      lastSolvedAt: '2026-01-03T00:00:00Z',
    });

    const res = await api().get('/api/v1/leaderboard').query({ page: 1, limit: 10 });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 3);
    assert.ok(res.body.meta.pagination);

    // b (10 solved) first; then c (5 solved, higher acceptance); then a.
    assert.equal(res.body.data[0].userId, b.user.id);
    assert.equal(res.body.data[0].rank, 1);
    assert.equal(res.body.data[1].userId, c.user.id);
    assert.equal(res.body.data[1].rank, 2);
    assert.equal(res.body.data[2].userId, a.user.id);
    assert.equal(res.body.data[2].rank, 3);
  });

  it('returns a single user rank', async (t) => {
    if (!requireInfra(t)) return;

    const top = await createUser();
    const mid = await createUser();

    await seedUserStatistics(top.user.id, {
      problemsSolved: 20,
      totalSubmissions: 20,
      totalAccepted: 20,
      acceptanceRate: 100,
    });
    await seedUserStatistics(mid.user.id, {
      problemsSolved: 3,
      totalSubmissions: 10,
      totalAccepted: 3,
      acceptanceRate: 30,
    });

    const res = await api().get(`/api/v1/leaderboard/users/${mid.user.id}/rank`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.userId, mid.user.id);
    assert.equal(res.body.data.rank, 2);
    assert.equal(res.body.data.problemsSolved, 3);
  });
});
