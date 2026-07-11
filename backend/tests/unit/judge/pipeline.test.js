const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { runJudgePipeline } = require('../../../src/modules/judge/judge.pipeline');

function makeDeps({ failFast, cases, runImpl }) {
  const completed = [];
  return {
    completed,
    deps: {
      failFast,
      submissions: {
        getSubmissionById: async () => ({
          id: 'sub-1',
          problemId: 'prob-1',
          language: 'python',
          sourceCode: 'print(1)',
        }),
        completeSubmission: async (_id, payload) => {
          completed.push(payload);
          return payload;
        },
      },
      problems: {
        getProblemById: async () => ({
          id: 'prob-1',
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        }),
      },
      docker: {
        createSandbox: async () => ({ id: 'box' }),
        copyFiles: async () => {},
        cleanup: async () => {},
      },
      compile: async () => ({ success: true, stdout: '', stderr: '' }),
      run: runImpl,
      compare: (stdout, expected) => ({ matches: String(stdout).trim() === String(expected).trim() }),
      loadTestCases: async () => cases,
      sourceFiles: { python: 'main.py', cpp: 'main.cpp' },
      images: { python: 'judgex-python', cpp: 'judgex-cpp' },
    },
  };
}

describe('runJudgePipeline fail-fast', () => {
  it('stops after first WA when failFast is true', async () => {
    let runs = 0;
    const { completed, deps } = makeDeps({
      failFast: true,
      cases: [
        { input: '1', expectedOutput: '1' },
        { input: '2', expectedOutput: '2' },
      ],
      runImpl: async () => {
        runs += 1;
        return {
          stdout: 'wrong',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          oomKilled: false,
          durationMs: 3,
        };
      },
    });

    const outcome = await runJudgePipeline('sub-1', deps);
    assert.equal(outcome.verdict, 'wrong_answer');
    assert.equal(runs, 1);
    assert.equal(completed[0].passedTests, 0);
    assert.equal(completed[0].totalTests, 2);
    assert.equal(completed[0].failedTestIndex, 0);
    assert.equal(completed[0].stdout, 'wrong');
  });

  it('continues after WA when failFast is false', async () => {
    let runs = 0;
    const { completed, deps } = makeDeps({
      failFast: false,
      cases: [
        { input: '1', expectedOutput: '1' },
        { input: '2', expectedOutput: '2' },
      ],
      runImpl: async (_lang, _sandbox, { input }) => {
        runs += 1;
        return {
          stdout: input === '2' ? '2' : 'wrong',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          oomKilled: false,
          durationMs: 3,
        };
      },
    });

    const outcome = await runJudgePipeline('sub-1', deps);
    assert.equal(outcome.verdict, 'wrong_answer');
    assert.equal(runs, 2);
    assert.equal(completed[0].passedTests, 1);
    assert.equal(completed[0].totalTests, 2);
    assert.equal(completed[0].failedTestIndex, 0);
  });

  it('stops early on compile error without running tests', async () => {
    let runs = 0;
    const { completed, deps } = makeDeps({
      failFast: true,
      cases: [{ input: '1', expectedOutput: '1' }],
      runImpl: async () => {
        runs += 1;
        return { stdout: '', stderr: '', exitCode: 0, timedOut: false, durationMs: 1 };
      },
    });
    deps.compile = async () => ({ success: false, stdout: '', stderr: 'syntax error' });

    const outcome = await runJudgePipeline('sub-1', deps);
    assert.equal(outcome.verdict, 'compile_error');
    assert.equal(runs, 0);
    assert.equal(completed[0].compileOutput, 'syntax error');
    assert.equal(completed[0].totalTests, 0);
  });
});
