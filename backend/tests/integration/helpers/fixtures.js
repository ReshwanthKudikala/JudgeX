// Shared HTTP + domain fixtures for integration suites.

const request = require('supertest');
const { getApp, query } = require('./setup');
const { TWO_SUM } = require('../../../scripts/demo-problems-data');

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

/**
 * Create a published problem. Defaults match the Two Sum demo catalog entry
 * (full statement + constraints). Does not attach sample cases — callers that
 * need examples should POST/PUT test cases explicitly (keeps existing tests stable).
 */
async function createPublishedProblem(adminToken, overrides = {}) {
  const slug = overrides.slug || unique('prob');
  const body = {
    title: TWO_SUM.title,
    statement: TWO_SUM.statement,
    constraintsText: TWO_SUM.constraintsText,
    difficulty: TWO_SUM.difficulty,
    isPublished: true,
    timeLimitMs: TWO_SUM.timeLimitMs,
    memoryLimitMb: TWO_SUM.memoryLimitMb,
    ...overrides,
    slug,
  };

  const res = await api()
    .post('/api/v1/admin/problems')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
  return { res, slug };
}

/**
 * Attach public demo samples (isSample) without replace-all,
 * so callers can add hidden cases separately afterward.
 */
async function attachDemoSamples(adminToken, problemId, samples = TWO_SUM.samples) {
  const created = [];
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const res = await api()
      .post(`/api/v1/admin/problems/${problemId}/testcases`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        input: sample.input,
        expectedOutput: sample.expectedOutput,
        explanation: sample.explanation,
        isSample: true,
        displayOrder: i,
      });
    created.push(res);
  }
  return created;
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

/**
 * Seed a judged submission row directly (for leaderboard ranking tests).
 * Does not enqueue the worker.
 */
async function seedJudgedSubmission(userId, problemId, opts = {}) {
  const { randomUUID } = require('crypto');
  const id = opts.id || randomUUID();
  const language = opts.language || 'python';
  const verdict = opts.verdict || 'accepted';
  const status = opts.status || 'completed';
  const sourceCode = opts.sourceCode || 'print(1)';
  const submittedAt = opts.submittedAt || new Date().toISOString();

  await query(
    `INSERT INTO submissions
       (id, user_id, problem_id, language, source_code, status, verdict, submitted_at, judged_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $8::timestamptz)`,
    [id, userId, problemId, language, sourceCode, status, verdict, submittedAt],
  );
  return id;
}

module.exports = {
  api,
  unique,
  registerUser,
  loginUser,
  createAdmin,
  createUser,
  createPublishedProblem,
  attachDemoSamples,
  seedUserStatistics,
  seedJudgedSubmission,
  TWO_SUM,
};
