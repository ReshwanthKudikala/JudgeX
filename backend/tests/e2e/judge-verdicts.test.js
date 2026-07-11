/**
 * Sprint 14 — Judge end-to-end: submit → BullMQ → worker → Docker → verdict.
 * Real Postgres, Redis, worker, and sandbox containers. No mocks.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./bootstrap');
const {
  registerE2eHooks,
  waitForTerminalSubmission,
  assertJobCompleted,
} = require('./helpers/harness');
const {
  api,
  createAdmin,
  createUser,
  createPublishedProblem,
  unique,
} = require('../integration/helpers/fixtures');

const { requireE2e } = registerE2eHooks();

const ECHO_PLUS = String.raw`a, b = map(int, input().split())
print(a + b)
`;

async function seedProblemWithCases(adminToken, { slug, timeLimitMs = 2000, cases }) {
  const { res: problemRes } = await createPublishedProblem(adminToken, {
    slug,
    title: 'A + B',
    statement: 'Print the sum of two integers.',
    timeLimitMs,
    memoryLimitMb: 256,
  });
  assert.equal(problemRes.status, 201, JSON.stringify(problemRes.body));
  const problemId = problemRes.body.data.id;

  const tcRes = await api()
    .put(`/api/v1/admin/problems/${problemId}/testcases`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      testCases: cases.map((c, i) => ({
        input: c.input,
        expectedOutput: c.expectedOutput,
        isHidden: c.isHidden ?? i > 0,
        displayOrder: i,
      })),
    });
  assert.equal(tcRes.status, 200, JSON.stringify(tcRes.body));
  return problemId;
}

async function submitAndJudge({ accessToken, problemId, language, sourceCode }) {
  const submit = await api()
    .post('/api/v1/submissions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ problemId, language, sourceCode });

  assert.equal(submit.status, 202, JSON.stringify(submit.body));
  assert.equal(submit.body.data.status, 'queued');
  const submissionId = submit.body.data.id;

  const row = await waitForTerminalSubmission(submissionId);
  const queue = await assertJobCompleted(submissionId);
  return { submissionId, row, queue };
}

describe('Judge end-to-end (Docker + queue + worker)', () => {
  it('Accepted: correct Python solution persists accepted + runtime metrics', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-ac'),
      cases: [
        { input: '1 2\n', expectedOutput: '3\n' },
        { input: '10 20\n', expectedOutput: '30\n', isHidden: true },
      ],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: ECHO_PLUS,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted');
    assert.equal(row.failed_test_index, null);
    assert.equal(row.compile_output, null);
    assert.equal(typeof row.runtime_ms, 'number');
    assert.ok(row.runtime_ms >= 0);
    assert.ok(row.judged_at);
    assert.equal(queue.returnvalue.verdict, 'accepted');
  });

  it('Wrong Answer: incorrect output persists wrong_answer and failed_test_index', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-wa'),
      cases: [{ input: '1 2\n', expectedOutput: '3\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: String.raw`a, b = map(int, input().split())
print(a - b)
`,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'wrong_answer');
    assert.equal(row.failed_test_index, 0);
    assert.equal(typeof row.runtime_ms, 'number');
    assert.ok(row.runtime_ms >= 0);
    assert.equal(queue.returnvalue.verdict, 'wrong_answer');
  });

  it('Compile Error: invalid Python syntax persists compile_error + compile_output', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-ce'),
      cases: [{ input: '1 2\n', expectedOutput: '3\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: 'def (\n',
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'compile_error');
    assert.equal(row.failed_test_index, null);
    assert.ok(row.compile_output && row.compile_output.length > 0);
    assert.equal(row.runtime_ms, null);
    assert.equal(queue.returnvalue.verdict, 'compile_error');
  });

  it('Runtime Error: non-zero exit persists runtime_error', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-re'),
      cases: [{ input: '1 2\n', expectedOutput: '3\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: 'raise SystemExit(1)\n',
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'runtime_error');
    assert.equal(row.failed_test_index, 0);
    assert.equal(typeof row.runtime_ms, 'number');
    assert.ok(row.runtime_ms >= 0);
    assert.equal(queue.returnvalue.verdict, 'runtime_error');
  });

  it('Time Limit Exceeded: infinite loop under a tight limit persists tle', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const timeLimitMs = 500;
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-tle'),
      timeLimitMs,
      cases: [{ input: '1 2\n', expectedOutput: '3\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: 'while True:\n    pass\n',
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'tle');
    assert.equal(row.failed_test_index, 0);
    assert.equal(typeof row.runtime_ms, 'number');
    // Wall-clock kill should land at or after the problem time limit.
    assert.ok(
      row.runtime_ms >= timeLimitMs,
      `expected runtime_ms >= ${timeLimitMs}, got ${row.runtime_ms}`,
    );
    assert.equal(queue.returnvalue.verdict, 'tle');
  });
});
