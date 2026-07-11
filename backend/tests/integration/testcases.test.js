const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/bootstrap');
const { registerSuiteHooks } = require('./helpers/hooks');
const { api, createAdmin, createPublishedProblem, unique } = require('./helpers/fixtures');
const { query } = require('./helpers/setup');
const { testCaseService } = require('../../src/modules/problems/testcase.service');

const { requireInfra } = registerSuiteHooks();

describe('Test case replacement', () => {
  it('atomically replaces the full test-case set via admin API', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const { res: created } = await createPublishedProblem(admin.accessToken, {
      slug: unique('tc-atomic'),
    });
    const problemId = created.body.data.id;

    // Seed an initial set.
    await api()
      .put(`/api/v1/admin/problems/${problemId}/testcases`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        testCases: [
          { input: '1', expectedOutput: '1', isHidden: false, displayOrder: 0 },
          { input: '2', expectedOutput: '2', isHidden: true, displayOrder: 1 },
        ],
      })
      .expect(200);

    // Replace with a different set.
    const replace = await api()
      .put(`/api/v1/admin/problems/${problemId}/testcases`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        testCases: [
          { input: '10', expectedOutput: '10', isHidden: false, displayOrder: 0 },
          { input: '20', expectedOutput: '20', isHidden: true, displayOrder: 1 },
          { input: '30', expectedOutput: '30', isHidden: true, displayOrder: 2 },
        ],
      });

    assert.equal(replace.status, 200);
    assert.equal(replace.body.data.count, 3);

    const judgeCases = await testCaseService.getJudgeTestCases(problemId);
    assert.equal(judgeCases.length, 3);
    assert.deepEqual(
      judgeCases.map((c) => c.input_ref),
      ['10', '20', '30'],
    );

    const publicCases = await testCaseService.getPublicExamples(problemId);
    assert.equal(publicCases.length, 1);
    assert.equal(publicCases[0].input_ref, '10');
  });

  it('rolls back when replacement insert fails inside the transaction', async (t) => {
    if (!requireInfra(t)) return;

    const admin = await createAdmin();
    const { res: created } = await createPublishedProblem(admin.accessToken, {
      slug: unique('tc-rollback'),
    });
    const problemId = created.body.data.id;

    await testCaseService.replaceAllTestCases(problemId, [
      {
        inputRef: 'keep-me',
        expectedOutputRef: 'keep-me',
        isHidden: true,
        isInline: true,
        sizeBytes: 14,
        displayOrder: 0,
      },
    ]);

    const before = await testCaseService.getJudgeTestCases(problemId);
    assert.equal(before.length, 1);
    assert.equal(before[0].input_ref, 'keep-me');

    // Force a NOT NULL violation on the insert half of delete+insert.
    await assert.rejects(
      () =>
        testCaseService.replaceAllTestCases(problemId, [
          {
            inputRef: null,
            expectedOutputRef: 'x',
            isHidden: true,
            isInline: true,
            sizeBytes: 1,
            displayOrder: 0,
          },
        ]),
      (err) => {
        assert.ok(err);
        return true;
      },
    );

    const after = await testCaseService.getJudgeTestCases(problemId);
    assert.equal(after.length, 1, 'original cases must survive a failed replace');
    assert.equal(after[0].input_ref, 'keep-me');

    const count = await query('SELECT COUNT(*)::int AS n FROM test_cases WHERE problem_id = $1', [
      problemId,
    ]);
    assert.equal(count.rows[0].n, 1);
  });
});
