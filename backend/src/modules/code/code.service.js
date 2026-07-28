// Run Code business logic: public-sample / custom-stdin execution via the shared
// ExecutionService. No submissions, no stats, no leaderboard writes.
//
// Public samples only (getPublicExamples). Hidden judge cases are never loaded.
//
// API path: validate problem → enqueue Run job → wait for worker result.
// Worker path: executeCodeRun() → withExecution (Docker only on the worker).

const { withExecution } = require('../judge/execution.service');
const { compareOutputs } = require('../judge/comparator');
const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');
const { resolveTestCase } = require('../../infrastructure/storage/storage.adapter');
const { enqueueRunAndWait } = require('../../infrastructure/queue/queue.service');
const { ValidationError } = require('../../shared/errors/http-errors');

/**
 * @param {object} compileResult
 * @returns {object} HTTP compile-error payload (no sample cards).
 */
function toCompileErrorResponse(compileResult) {
  return {
    status: 'compile_error',
    compile: {
      success: false,
      stdout: compileResult.stdout || null,
      stderr: compileResult.stderr || null,
    },
    results: [],
    passedCount: 0,
    totalCount: 0,
    stderr: compileResult.stderr || compileResult.stdout || null,
  };
}

/**
 * Build one sample/custom case result entry.
 */
function toCaseResult({ index, input, expectedOutput, runResult, compare = true }) {
  const timedOut = Boolean(runResult?.timedOut);
  const actualOutput = runResult?.stdout ?? null;
  const stderr = runResult?.stderr?.trim() ? runResult.stderr : null;

  let passed = null;
  if (compare && expectedOutput != null && !timedOut && runResult?.exitCode === 0) {
    passed = compareOutputs(actualOutput, expectedOutput).matches;
  } else if (compare && expectedOutput != null) {
    passed = false;
  }

  return {
    index,
    input,
    expectedOutput: expectedOutput ?? null,
    actualOutput,
    passed,
    runtimeMs: runResult?.durationMs ?? null,
    stderr,
    timedOut,
    exitCode: runResult?.exitCode ?? null,
  };
}

function aggregateStatus(results) {
  if (!results.length) return 'ok';
  if (results.some((r) => r.timedOut)) return 'time_limit';
  if (results.some((r) => r.exitCode != null && r.exitCode !== 0 && !r.timedOut)) {
    return 'runtime_error';
  }
  if (results.some((r) => r.passed === false)) return 'failed';
  return 'ok';
}

/**
 * Worker-side execution: compile once + run public samples (or custom stdin).
 * Uses Docker via ExecutionService — must only run on the judge worker.
 *
 * @param {{ problemId: string, language: string, sourceCode: string, customInput?: string }} input
 * @param {object} [deps]
 * @returns {Promise<object>} Run response payload
 */
async function executeCodeRun(input, deps = {}) {
  const {
    problems = problemService,
    testCases = testCaseService,
    execute = withExecution,
  } = deps;

  const { problemId, language, sourceCode, customInput } = input;
  const problem = await problems.getProblemById(problemId);

  /** @type {Array<{ input: string, expectedOutput: string|null, compare: boolean }>} */
  let cases;

  if (customInput !== undefined) {
    cases = [
      {
        input: customInput,
        expectedOutput: null,
        compare: false,
      },
    ];
  } else {
    const publicRows = await testCases.getPublicExamples(problemId);
    if (!Array.isArray(publicRows) || publicRows.length === 0) {
      throw new ValidationError(
        'This problem has no public sample input. Provide customInput to run.',
      );
    }
    cases = publicRows.map((row) => {
      const hydrated = resolveTestCase(row);
      return {
        input: hydrated.input ?? '',
        expectedOutput: hydrated.expectedOutput ?? '',
        compare: true,
      };
    });
  }

  return execute(
    {
      language,
      sourceCode,
      memoryMb: problem.memoryLimitMb,
    },
    async ({ compileResult, runCase }) => {
      if (!compileResult.success) {
        return toCompileErrorResponse(compileResult);
      }

      const results = [];
      for (let i = 0; i < cases.length; i += 1) {
        const c = cases[i];
        // eslint-disable-next-line no-await-in-loop -- sequential sandbox runs
        const runResult = await runCase(c.input, problem.timeLimitMs);
        results.push(
          toCaseResult({
            index: i,
            input: c.input,
            expectedOutput: c.expectedOutput,
            runResult,
            compare: c.compare,
          }),
        );
      }

      const passedCount = results.filter((r) => r.passed === true).length;
      const totalCount = results.filter((r) => r.passed !== null).length;

      return {
        status: aggregateStatus(results),
        compile: {
          success: true,
          stdout: compileResult.stdout || null,
          stderr: compileResult.stderr || null,
        },
        results,
        passedCount,
        totalCount,
      };
    },
  );
}

/**
 * API-side Run: enqueue to the judge worker and wait for the result.
 * Never calls Docker / ExecutionService in the API process.
 */
class CodeService {
  constructor({
    problems = problemService,
    enqueueRun = enqueueRunAndWait,
  } = {}) {
    this.problems = problems;
    this.enqueueRun = enqueueRun;
  }

  /**
   * @param {{
   *   problemId: string,
   *   language: string,
   *   sourceCode: string,
   *   customInput?: string,
   *   requestId?: string,
   * }} input
   */
  async runCode(input) {
    const { problemId, language, sourceCode, customInput, requestId } = input;

    // Fast-fail unknown problems on the API (no worker round-trip).
    await this.problems.getProblemById(problemId);

    const payload = {
      problemId,
      language,
      sourceCode,
    };
    if (customInput !== undefined) {
      payload.customInput = customInput;
    }
    if (requestId) {
      payload.requestId = requestId;
    }

    return this.enqueueRun(payload);
  }
}

module.exports = {
  CodeService,
  codeService: new CodeService(),
  executeCodeRun,
  toCompileErrorResponse,
  toCaseResult,
  aggregateStatus,
};
