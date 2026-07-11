// Shared HTTP + domain fixtures for integration suites.

const request = require('supertest');
const { getApp, query } = require('./setup');

function api() {
  return request(getApp());
}

let counter = 0;
function unique(prefix = 'u') {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

async function registerUser(overrides = {}) {
  const username = overrides.username || unique('user');
  const email = overrides.email || `${username}@example.com`;
  const password = overrides.password || 'password123';

  const res = await api().post('/api/v1/auth/register').send({ username, email, password });
  return { res, username, email, password };
}

async function loginUser({ email, password }) {
  return api().post('/api/v1/auth/login').send({ email, password });
}

/** Register a normal user and promote them to admin via SQL (role lives in DB). */
async function createAdmin() {
  const { res, email, password, username } = await registerUser({ username: unique('admin') });
  if (res.status !== 201) {
    throw new Error(`Failed to register admin seed user: ${res.status} ${JSON.stringify(res.body)}`);
  }
  await query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
  // authenticate loads role from DB, so the original token is fine for authorize().
  return {
    accessToken: res.body.data.accessToken,
    user: res.body.data.user,
    email,
    password,
    username,
  };
}

async function createUser() {
  const { res, email, password, username } = await registerUser();
  if (res.status !== 201) {
    throw new Error(`Failed to register user: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.data.accessToken,
    user: res.body.data.user,
    email,
    password,
    username,
  };
}

async function createPublishedProblem(adminToken, overrides = {}) {
  const slug = overrides.slug || unique('prob');
  const body = {
    title: 'Two Sum',
    statement: 'Find two numbers that add up to target.',
    difficulty: 'easy',
    isPublished: true,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    ...overrides,
    slug,
  };

  const res = await api()
    .post('/api/v1/admin/problems')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
  return { res, slug };
}

async function seedUserStatistics(userId, stats = {}) {
  await query(
    `INSERT INTO user_statistics
       (user_id, problems_solved, total_submissions, total_accepted, acceptance_rate, last_solved_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       problems_solved = EXCLUDED.problems_solved,
       total_submissions = EXCLUDED.total_submissions,
       total_accepted = EXCLUDED.total_accepted,
       acceptance_rate = EXCLUDED.acceptance_rate,
       last_solved_at = EXCLUDED.last_solved_at`,
    [
      userId,
      stats.problemsSolved ?? 0,
      stats.totalSubmissions ?? 0,
      stats.totalAccepted ?? 0,
      stats.acceptanceRate ?? 0,
      stats.lastSolvedAt ?? null,
    ],
  );
}

module.exports = {
  api,
  unique,
  registerUser,
  loginUser,
  createAdmin,
  createUser,
  createPublishedProblem,
  seedUserStatistics,
};
