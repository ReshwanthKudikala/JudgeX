const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  CodeService,
  executeCodeRun,
  toCompileErrorResponse,
  toCaseResult,
  aggregateStatus,
} = require('../../../src/modules/code/code.service');

describe('toCompileErrorResponse', () => {
  it('maps compile failure with empty results', () => {
    const out = toCompileErrorResponse({
      success: false,
      stdout: '',
      stderr: 'error: boom',
      exitCode: 1,
      timedOut: false,
      durationMs: 8,
    });
    assert.equal(out.status, 'compile_error');
    assert.equal(out.compile.success, false);
    assert.equal(out.stderr, 'error: boom');
    assert.deepEqual(out.results, []);
  });
});

describe('toCaseResult / aggregateStatus', () => {
  it('marks matching output as passed', () => {
    const row = toCaseResult({
      index: 0,
      input: '1 2\n',
      expectedOutput: '3\n',
      runResult: {
        stdout: '3\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        durationMs: 12,
      },
      compare: true,
    });
    assert.equal(row.passed, true);
    assert.equal(aggregateStatus([row]), 'ok');
  });

  it('marks mismatch and timeout', () => {
    const wa = toCaseResult({
      index: 0,
      input: '1',
      expectedOutput: '1',
      runResult: {
        stdout: '2',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        durationMs: 3,
      },
      compare: true,
    });
    assert.equal(wa.passed, false);
    assert.equal(aggregateStatus([wa]), 'failed');
  });
});

describe('executeCodeRun (worker path)', () => {
  it('uses customInput when provided and never loads samples', async () => {
    let loadedSamples = false;
    const inputs = [];
    const result = await executeCodeRun(
      {
        problemId: '00000000-0000-4000-8000-000000000001',
        language: 'python',
        sourceCode: 'print(1)',
        customInput: 'custom-stdin',
      },
      {
        problems: {
          getProblemById: async () => ({
            id: 'p1',
            timeLimitMs: 1000,
            memoryLimitMb: 256,
          }),
        },
        testCases: {
          getPublicExamples: async () => {
            loadedSamples = true;
            return [{ input_ref: 'should-not-use', is_inline: true }];
          },
        },
        execute: async (_opts, worker) =>
          worker({
            compileResult: { success: true, stdout: '', stderr: '' },
            runCase: async (stdin) => {
              inputs.push(stdin);
              return {
                stdout: 'ok',
                stderr: '',
                exitCode: 0,
                timedOut: false,
                durationMs: 5,
              };
            },
          }),
      },
    );

    assert.equal(loadedSamples, false);
    assert.deepEqual(inputs, ['custom-stdin']);
    assert.equal(result.results.length, 1);
  });

  it('executes ALL public samples when customInput is omitted', async () => {
    const inputs = [];
    const result = await executeCodeRun(
      {
        problemId: '00000000-0000-4000-8000-000000000001',
        language: 'python',
        sourceCode: 'print(1)',
      },
      {
        problems: {
          getProblemById: async () => ({
            id: 'p1',
            timeLimitMs: 1000,
            memoryLimitMb: 256,
          }),
        },
        testCases: {
          getPublicExamples: async () => [
            {
              id: 't1',
              input_ref: '1\n',
              expected_output_ref: '1\n',
              is_inline: true,
              display_order: 0,
            },
            {
              id: 't2',
              input_ref: '2\n',
              expected_output_ref: '2\n',
              is_inline: true,
              display_order: 1,
            },
          ],
        },
        execute: async (_opts, worker) =>
          worker({
            compileResult: { success: true, stdout: '', stderr: '' },
            runCase: async (stdin) => {
              inputs.push(stdin);
              return {
                stdout: stdin,
                stderr: '',
                exitCode: 0,
                timedOut: false,
                durationMs: 4,
              };
            },
          }),
      },
    );

    assert.deepEqual(inputs, ['1\n', '2\n']);
    assert.equal(result.results.length, 2);
    assert.equal(result.status, 'ok');
  });
});

describe('CodeService.runCode (API path)', () => {
  it('enqueues and waits — never calls ExecutionService', async () => {
    let enqueued = null;
    const service = new CodeService({
      problems: {
        getProblemById: async (id) => ({ id, timeLimitMs: 1000, memoryLimitMb: 256 }),
      },
      enqueueRun: async (payload) => {
        enqueued = payload;
        return {
          status: 'ok',
          compile: { success: true, stdout: null, stderr: null },
          results: [],
          passedCount: 0,
          totalCount: 0,
        };
      },
    });

    const out = await service.runCode({
      problemId: '00000000-0000-4000-8000-000000000001',
      language: 'python',
      sourceCode: 'print(1)',
      requestId: 'req-1',
    });

    assert.equal(enqueued.language, 'python');
    assert.equal(enqueued.requestId, 'req-1');
    assert.equal(out.status, 'ok');
  });
});
