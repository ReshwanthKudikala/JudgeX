// Run Code business logic: public-sample / custom-stdin execution via the shared
// ExecutionService. No submissions, no queue, no stats, no leaderboard writes.

const { withExecution } = require('../judge/execution.service');
const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');
const { resolveInput } = require('../../infrastructure/storage/storage.adapter');
const { ValidationError } = require('../../shared/errors/http-errors');

/**
 * Map compile + single-run outcomes to the HTTP Run response shape.
 * @param {{ compileResult: object, runResult: object|null, stdin: string }} parts
 */
function toRunResponse({ compileResult, runResult, stdin }) {
  if (!compileResult.success) {
    return {
      status: 'compile_error',
      compile: {
        success: false,
        stdout: compileResult.stdout || null,
        stderr: compileResult.stderr || null,
      },
      stdin,
      stdout: compileResult.stdout || null,
      stderr: compileResult.stderr || null,
      exitCode: compileResult.exitCode ?? null,
      runtimeMs: compileResult.durationMs ?? null,
      memoryKb: null,
      timedOut: Boolean(compileResult.timedOut),
    };
  }

  const timedOut = Boolean(runResult?.timedOut);
  let status = 'ok';
  if (timedOut) {
    status = 'time_limit';
  } else if (runResult && runResult.exitCode !== 0) {
    status = 'runtime_error';
  }

  return {
    status,
    compile: {
      success: true,
      stdout: compileResult.stdout || null,
      stderr: compileResult.stderr || null,
    },
    stdin,
    stdout: runResult?.stdout ?? null,
    stderr: runResult?.stderr ?? null,
    exitCode: runResult?.exitCode ?? null,
    runtimeMs: runResult?.durationMs ?? null,
    memoryKb: runResult?.memoryKb ?? null,
    timedOut,
  };
}

class CodeService {
  constructor({
    problems = problemService,
    testCases = testCaseService,
    execute = withExecution,
  } = {}) {
    this.problems = problems;
    this.testCases = testCases;
    this.execute = execute;
  }

  /**
   * Compile + execute against custom stdin or the first public sample.
   * @param {{ problemId: string, language: string, sourceCode: string, customInput?: string }} input
   */
  async runCode(input) {
    const { problemId, language, sourceCode, customInput } = input;

    const problem = await this.problems.getProblemById(problemId);

    let stdin;
    if (customInput !== undefined) {
      stdin = customInput;
    } else {
      const publicRows = await this.testCases.getPublicExamples(problemId);
      if (!Array.isArray(publicRows) || publicRows.length === 0) {
        throw new ValidationError(
          'This problem has no public sample input. Provide customInput to run.',
        );
      }
      stdin = resolveInput(publicRows[0]);
      if (stdin == null) {
        throw new ValidationError('Public sample input could not be resolved.');
      }
    }

    return this.execute(
      {
        language,
        sourceCode,
        memoryMb: problem.memoryLimitMb,
      },
      async ({ compileResult, runCase }) => {
        if (!compileResult.success) {
          return toRunResponse({ compileResult, runResult: null, stdin });
        }

        const runResult = await runCase(stdin, problem.timeLimitMs);
        return toRunResponse({ compileResult, runResult, stdin });
      },
    );
  }
}

module.exports = {
  CodeService,
  codeService: new CodeService(),
  toRunResponse,
};
