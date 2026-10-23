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
const { query } = require('../integration/helpers/setup');

const ECHO_PLUS = String.raw`a, b = map(int, input().split())
print(a + b)
`;

async function seedProblemWithCases(adminToken, {
  slug,
  timeLimitMs = 2000,
  memoryLimitMb = 256,
  cases,
}) {
  const { res: problemRes } = await createPublishedProblem(adminToken, {
    slug,
    title: 'A + B',
    statement: 'Print the sum of two integers.',
    timeLimitMs,
    memoryLimitMb,
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

async function submitAndJudge({
  accessToken,
  problemId,
  language,
  sourceCode,
  timeoutMs,
}) {
  const submit = await api()
    .post('/api/v1/submissions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ problemId, language, sourceCode });

  assert.equal(submit.status, 202, JSON.stringify(submit.body));
  assert.equal(submit.body.data.status, 'queued');
  const submissionId = submit.body.data.id;

  const row = await waitForTerminalSubmission(
    submissionId,
    timeoutMs ? { timeoutMs } : {},
  );
  const queue = await assertJobCompleted(submissionId);
  return { submissionId, row, queue };
}

const CPP_ECHO_PLUS = `#include <iostream>
int main() {
  long long a = 0, b = 0;
  std::cin >> a >> b;
  std::cout << (a + b) << '\\n';
  return 0;
}
`;

// Problem memory cap used by the sandbox. Matches the schema default and
// JUDGE_MEMORY_LIMIT_MB (256). The program allocates past that cap.
const PROBLEM_MEMORY_LIMIT_MB = 256;

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

    const { rows: caseRows } = await query(
      `SELECT test_index, status
         FROM submission_test_results
        WHERE submission_id = $1
        ORDER BY test_index`,
      [row.id],
    );
    assert.equal(caseRows.length, 2);
    assert.equal(caseRows[0].status, 'accepted');
    assert.equal(caseRows[1].status, 'accepted');
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

  it('C++ Accepted: valid solution compiles and persists accepted', { timeout: 70_000 }, async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-cpp-ac'),
      cases: [
        { input: '1 2\n', expectedOutput: '3\n' },
        { input: '10 20\n', expectedOutput: '30\n', isHidden: true },
      ],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'cpp',
      sourceCode: CPP_ECHO_PLUS,
      timeoutMs: 60_000,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted');
    assert.equal(row.failed_test_index, null);
    assert.equal(row.compile_output, null);
    assert.equal(typeof row.runtime_ms, 'number');
    assert.ok(row.runtime_ms >= 0);
    assert.ok(row.judged_at);
    assert.equal(queue.returnvalue.verdict, 'accepted');

    const { rows: caseRows } = await query(
      `SELECT test_index, status
         FROM submission_test_results
        WHERE submission_id = $1
        ORDER BY test_index`,
      [row.id],
    );
    assert.equal(caseRows.length, 2);
    assert.equal(caseRows[0].status, 'accepted');
    assert.equal(caseRows[1].status, 'accepted');
  });

  it('C++ Compile Error: invalid source persists compile_error + compile_output', { timeout: 70_000 }, async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-cpp-ce'),
      cases: [{ input: '1 2\n', expectedOutput: '3\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'cpp',
      sourceCode: 'int main( {\n',
      timeoutMs: 60_000,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'compile_error');
    assert.equal(row.failed_test_index, null);
    assert.ok(row.compile_output && row.compile_output.length > 0);
    assert.equal(row.runtime_ms, null);
    assert.equal(queue.returnvalue.verdict, 'compile_error');
  });

  it('Memory Limit Exceeded: allocation past the problem cap persists memory_limit_exceeded', { timeout: 50_000 }, async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-mle'),
      timeLimitMs: 10_000,
      memoryLimitMb: PROBLEM_MEMORY_LIMIT_MB,
      cases: [{ input: '\n', expectedOutput: '0\n' }],
    });

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode: `blocks = []
need = 400 * 1024 * 1024
size = 8 * 1024 * 1024
while need > 0:
    block = bytearray(size)
    block[-1] = 1
    blocks.append(block)
    need -= size
print(len(blocks))
`,
      timeoutMs: 40_000,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'memory_limit_exceeded');
    assert.equal(row.failed_test_index, 0);
    assert.equal(queue.returnvalue.verdict, 'memory_limit_exceeded');

    const { rows: caseRows } = await query(
      `SELECT test_index, status
         FROM submission_test_results
        WHERE submission_id = $1
        ORDER BY test_index`,
      [row.id],
    );
    assert.equal(caseRows.length, 1);
    assert.equal(caseRows[0].status, 'memory_limit_exceeded');
  });

  it('Run: public sample passes and does not create a submission', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-run'),
      cases: [{ input: '1 2\n', expectedOutput: '3\n', isHidden: false }],
    });

    const before = await query('SELECT COUNT(*)::int AS n FROM submissions');
    const res = await api()
      .post('/api/v1/code/run')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        problemId,
        language: 'python',
        sourceCode: ECHO_PLUS,
      });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.data.passedCount, 1);
    const after = await query('SELECT COUNT(*)::int AS n FROM submissions');
    assert.equal(after.rows[0].n, before.rows[0].n);
  });

  it('Network: an outbound TCP connect fails immediately inside the sandbox', async (t) => {
    if (!requireE2e(t)) return;

    const admin = await createAdmin();
    const user = await createUser();
    const problemId = await seedProblemWithCases(admin.accessToken, {
      slug: unique('e2e-net'),
      timeLimitMs: 5000,
      cases: [{ input: '\n', expectedOutput: 'blocked\n', isHidden: false }],
    });

    const sourceCode = `import errno
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(2)
try:
    sock.connect(("1.1.1.1", 443))
except OSError as exc:
    if exc.errno in (
        errno.ENETUNREACH,
        errno.EHOSTUNREACH,
        errno.ENETDOWN,
        errno.EADDRNOTAVAIL,
    ):
        print("blocked")
    else:
        print("other")
else:
    print("connected")
`;

    const { row, queue } = await submitAndJudge({
      accessToken: user.accessToken,
      problemId,
      language: 'python',
      sourceCode,
      timeoutMs: 20_000,
    });

    assert.equal(row.status, 'completed');
    assert.equal(row.verdict, 'accepted', JSON.stringify(row));
    assert.equal(queue.returnvalue.verdict, 'accepted');
    assert.equal(typeof row.runtime_ms, 'number');
    assert.ok(
      row.runtime_ms < 1500,
      `expected an immediate network-unreachable failure, runtime_ms=${row.runtime_ms}`,
    );
  });
});
