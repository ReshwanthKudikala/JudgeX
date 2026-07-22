// Coordinates the ordered stages of a single judge run (compile → run → compare
// → verdict → persist). Sandbox compile/run lifecycle is delegated to
// execution.service; this module owns comparison, verdict, fail-fast, and persist.
//
// This is ORCHESTRATION ONLY. It owns no judging rules itself: the compiler,
// runner, comparator, and verdict engine are pure/stage modules; persistence is
// delegated to SubmissionService; the sandbox is owned by the Docker adapter.
// Runs a single submission sequentially (no parallel judging) and ALWAYS tears
// the sandbox down via withExecution's finally block.
//
// Dependencies are injected (with real defaults) so the flow is unit-testable
// without Docker/Redis/DB.

const { config } = require('../../config');
const dockerAdapter = require('../../infrastructure/docker/docker.adapter');
const compiler = require('./compiler');
const runner = require('./runner');
const { withExecution, LANGUAGE_IMAGES } = require('./execution.service');
const { compareOutputs } = require('./comparator');
const { generateVerdict, VERDICTS } = require('./verdict-engine');
const { submissionService } = require('../submissions/submissions.service');
const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');
const { resolveTestCase } = require('../../infrastructure/storage/storage.adapter');
const { logger } = require('../../shared/logger/logger');
const { JudgeError } = require('../../shared/errors/domain-errors');

// Verdicts that invalidate the sandbox / make further runs unsafe.
const HARD_STOP_VERDICTS = new Set([
  VERDICTS.COMPILE_ERROR,
  VERDICTS.TLE,
  VERDICTS.MEMORY_LIMIT_EXCEEDED,
]);

// Load metadata rows (ordered by display_order) then hydrate each payload via the
// storage adapter. Inline payloads resolve to text; external payloads currently
// throw NotImplementedError, which is propagated unchanged (never swallowed).
async function defaultLoadTestCases(problemId) {
  const rows = await testCaseService.getJudgeTestCases(problemId);
  return rows.map((row) => resolveTestCase(row));
}

/**
 * Judge a single submission end-to-end and persist the terminal verdict.
 *
 * @param {string} submissionId - UUID of a submission already marked running.
 * @param {object} [deps] - injectable collaborators (default to real modules).
 * @returns {Promise<{verdict:string, passed:boolean, metrics:object}>}
 */
async function runJudgePipeline(submissionId, deps = {}) {
  const {
    submissions = submissionService,
    problems = problemService,
    docker = dockerAdapter,
    compile = compiler.compile,
    run = runner.run,
    compare = compareOutputs,
    verdict = generateVerdict,
    loadTestCases = defaultLoadTestCases,
    sourceFiles = compiler.SOURCE_FILES,
    images = LANGUAGE_IMAGES,
    failFast = config.judge.failFast,
  } = deps;

  // 1. Load the authoritative submission + problem (limits) from Postgres.
  const submission = await submissions.getSubmissionById(submissionId);
  const problem = await problems.getProblemById(submission.problemId);

  // 2–4 (+ cleanup): sandbox lifecycle + compile + per-case run via shared service.
  return withExecution(
    {
      language: submission.language,
      sourceCode: submission.sourceCode,
      memoryMb: problem.memoryLimitMb,
      docker,
      compile,
      run,
      sourceFiles,
      images,
    },
    async ({ compileResult, runCase }) => {
      // 5. Compile failed → verdict, persist, finish (no execution).
      if (!compileResult.success) {
        const outcome = verdict({ compileResult });
        logger.info('Compilation failed; finalizing', {
          submissionId,
          verdict: outcome.verdict,
        });
        await submissions.completeSubmission(submissionId, {
          verdict: outcome.verdict,
          compileOutput: compileResult.stderr || compileResult.stdout || null,
          runtimeMs: outcome.metrics.runtimeMs,
          memoryKb: outcome.metrics.memoryKb,
          failedTestIndex: null,
          passedTests: 0,
          totalTests: 0,
          stdout: compileResult.stdout || null,
          stderr: compileResult.stderr || null,
        });
        return outcome;
      }

      // 6. Run every test case sequentially; stop early on CE (already handled),
      //    hard-stop verdicts, or any failure when fail-fast is enabled.
      const testCases = await loadTestCases(submission.problemId);
      if (!Array.isArray(testCases) || testCases.length === 0) {
        throw new JudgeError('No test cases available for judging.');
      }

      const totalTests = testCases.length;
      let outcome = null;
      let maxRuntimeMs = 0;
      let maxMemoryKb = 0;
      let failedTestIndex = null;
      let passedTests = 0;
      let lastStdout = null;
      let lastStderr = null;

      for (let i = 0; i < testCases.length; i += 1) {
        const testCase = testCases[i];

        // eslint-disable-next-line no-await-in-loop -- sequential by design (no parallel judging).
        const runResult = await runCase(testCase.input, problem.timeLimitMs);
        maxRuntimeMs = Math.max(maxRuntimeMs, runResult.durationMs || 0);
        if (runResult.memoryKb) maxMemoryKb = Math.max(maxMemoryKb, runResult.memoryKb);
        lastStdout = runResult.stdout ?? null;
        lastStderr = runResult.stderr ?? null;

        const comparisonResult = compare(runResult.stdout, testCase.expectedOutput);
        const caseOutcome = verdict({ compileResult, runResult, comparisonResult });

        if (caseOutcome.passed) {
          passedTests += 1;
          // Keep the first failure as the final verdict when fail-fast is off.
          if (failedTestIndex === null) {
            outcome = caseOutcome;
          }
          continue;
        }

        // First failure wins as the final verdict (even when fail-fast is off).
        if (failedTestIndex === null) {
          failedTestIndex = i;
          outcome = caseOutcome;
        }

        const shouldStop =
          failFast || HARD_STOP_VERDICTS.has(caseOutcome.verdict);
        if (shouldStop) {
          break;
        }
      }

      if (!outcome) {
        throw new JudgeError('Judge pipeline produced no verdict.');
      }

      // 7. Persist the final verdict + aggregate metrics.
      logger.info('Judging finished; finalizing', {
        submissionId,
        verdict: outcome.verdict,
        failedTestIndex,
        passedTests,
        totalTests,
        failFast,
      });
      await submissions.completeSubmission(submissionId, {
        verdict: outcome.verdict,
        compileOutput: null,
        runtimeMs: maxRuntimeMs,
        memoryKb: maxMemoryKb || null,
        failedTestIndex,
        passedTests,
        totalTests,
        stdout: lastStdout,
        stderr: lastStderr,
      });
      return {
        ...outcome,
        metrics: {
          ...outcome.metrics,
          runtimeMs: maxRuntimeMs,
          memoryKb: maxMemoryKb || null,
          passedTests,
          totalTests,
          failedTestIndex,
        },
      };
    },
  );
}

module.exports = { runJudgePipeline, LANGUAGE_IMAGES };
