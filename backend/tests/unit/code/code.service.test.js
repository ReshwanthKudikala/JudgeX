const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { CodeService, toRunResponse } = require('../../../src/modules/code/code.service');

describe('toRunResponse', () => {
  it('maps compile failure', () => {
    const out = toRunResponse({
      compileResult: {
        success: false,
        stdout: '',
        stderr: 'error: boom',
        exitCode: 1,
        timedOut: false,
        durationMs: 8,
      },
      runResult: null,
      stdin: '1 2',
    });
    assert.equal(out.status, 'compile_error');
    assert.equal(out.compile.success, false);
    assert.equal(out.stderr, 'error: boom');
    assert.equal(out.stdin, '1 2');
  });

  it('maps successful run', () => {
    const out = toRunResponse({
      compileResult: { success: true, stdout: '', stderr: '' },
      runResult: {
        stdout: '3\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        durationMs: 12,
        memoryKb: null,
      },
      stdin: '1 2\n',
    });
    assert.equal(out.status, 'ok');
    assert.equal(out.stdout, '3\n');
    assert.equal(out.runtimeMs, 12);
    assert.equal(out.timedOut, false);
  });

  it('maps timeout', () => {
    const out = toRunResponse({
      compileResult: { success: true, stdout: '', stderr: '' },
      runResult: {
        stdout: '',
        stderr: '',
        exitCode: 137,
        timedOut: true,
        durationMs: 2000,
        memoryKb: null,
      },
      stdin: '',
    });
    assert.equal(out.status, 'time_limit');
    assert.equal(out.timedOut, true);
  });
});

describe('CodeService.runCode', () => {
  it('uses customInput when provided and never loads samples', async () => {
    let loadedSamples = false;
    let capturedStdin = null;
    const service = new CodeService({
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
            capturedStdin = stdin;
            return {
              stdout: 'ok',
              stderr: '',
              exitCode: 0,
              timedOut: false,
              durationMs: 5,
              memoryKb: null,
            };
          },
        }),
    });

    const result = await service.runCode({
      problemId: '00000000-0000-4000-8000-000000000001',
      language: 'python',
      sourceCode: 'print(1)',
      customInput: 'custom-stdin',
    });

    assert.equal(loadedSamples, false);
    assert.equal(capturedStdin, 'custom-stdin');
    assert.equal(result.status, 'ok');
    assert.equal(result.stdout, 'ok');
  });

  it('uses first public sample when customInput is omitted', async () => {
    let capturedStdin = null;
    const service = new CodeService({
      problems: {
        getProblemById: async () => ({
          id: 'p1',
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        }),
      },
      testCases: {
        getPublicExamples: async () => [
          { id: 't1', input_ref: 'sample-one', is_inline: true, display_order: 0 },
          { id: 't2', input_ref: 'sample-two', is_inline: true, display_order: 1 },
        ],
      },
      execute: async (_opts, worker) =>
        worker({
          compileResult: { success: true, stdout: '', stderr: '' },
          runCase: async (stdin) => {
            capturedStdin = stdin;
            return {
              stdout: 'out',
              stderr: '',
              exitCode: 0,
              timedOut: false,
              durationMs: 4,
              memoryKb: null,
            };
          },
        }),
    });

    const result = await service.runCode({
      problemId: '00000000-0000-4000-8000-000000000001',
      language: 'python',
      sourceCode: 'print(1)',
    });

    assert.equal(capturedStdin, 'sample-one');
    assert.equal(result.stdin, 'sample-one');
    assert.equal(result.status, 'ok');
  });
});
