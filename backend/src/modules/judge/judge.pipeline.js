// Coordinates the ordered stages of a single judge run (compile → run → compare
// → verdict → persist), reusing the existing stage modules exactly as they are.
//
// This is ORCHESTRATION ONLY. It owns no judging rules itself: the compiler,
// runner, comparator, and verdict engine are pure/stage modules; persistence is
// delegated to SubmissionService; the sandbox is owned by the Docker adapter.
// Runs a single submission sequentially (no parallel judging) and ALWAYS tears
// the sandbox down in a finally block.
//
// Dependencies are injected (with real defaults) so the flow is unit-testable
// without Docker/Redis/DB. NOTE: a real test-case data source is not built yet;
// callers must supply `loadTestCases`. The default refuses to judge rather than
// emit a false verdict.

const dockerAdapter = require('../../infrastructure/docker/docker.adapter');
const compiler = require('./compiler');
const runner = require('./runner');
const { compareOutputs } = require('./comparator');
const { generateVerdict } = require('./verdict-engine');
const { submissionService } = require('../submissions/submissions.service');
const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');
const { resolveTestCase } = require('../../infrastructure/storage/storage.adapter');
const { logger } = require('../../shared/logger/logger');
const { JudgeError } = require('../../shared/errors/domain-errors');

// Prebuilt sandbox image per language (built ahead of time; ARCHITECTURE.md §5.2).
const LANGUAGE_IMAGES = Object.freeze({ cpp: 'judgex-cpp', python: 'judgex-python' });

// Load metadata rows (ordered by display_order) then hydrate each payload via the
// storage adapter. Inline payloads resolve to text; external payloads currently
// throw NotImplementedError, which is propagated unchanged (never swallowed).
// The pipeline consumes the resulting { input, expectedOutput } items unchanged,
// so it stays storage-agnostic.
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
  } = deps;

  // 1. Load the authoritative submission + problem (limits) from Postgres.
  const submission = await submissions.getSubmissionById(submissionId);
  const problem = await problems.getProblemById(submission.problemId);

  const image = images[submission.language];
  if (!image) {
    throw new JudgeError(`No sandbox image for language: ${submission.language}`);
  }

  // 2. Create the locked-down sandbox (memory limit from the problem).
  const sandbox = await docker.createSandbox({
    image,
    memoryMb: problem.memoryLimitMb,
  });

  try {
    // 3. Copy the source file into the sandbox workspace.
    await docker.copyFiles(sandbox, [
      { path: sourceFiles[submission.language], content: submission.sourceCode },
    ]);

    // 4. Compile / prepare.
    const compileResult = await compile(submission.language, sandbox);

    // 5. Compile failed → verdict, persist, finish (no execution).
    if (!compileResult.success) {
      const outcome = verdict({ compileResult });
      logger.info('Compilation failed; finalizing', { submissionId, verdict: outcome.verdict });
      await submissions.completeSubmission(submissionId, {
        verdict: outcome.verdict,
        compileOutput: compileResult.stderr,
        runtimeMs: outcome.metrics.runtimeMs,
        memoryKb: outcome.metrics.memoryKb,
        failedTestIndex: null,
      });
      return outcome;
    }

    // 6. Otherwise run every test case sequentially; stop on first non-accepted.
    const testCases = await loadTestCases(submission.problemId);
    if (!Array.isArray(testCases) || testCases.length === 0) {
      throw new JudgeError('No test cases available for judging.');
    }

    let outcome = null;
    let maxRuntimeMs = 0;
    let maxMemoryKb = 0;
    let failedTestIndex = null;

    for (let i = 0; i < testCases.length; i += 1) {
      const testCase = testCases[i];

      // eslint-disable-next-line no-await-in-loop -- sequential by design (no parallel judging).
      const runResult = await run(submission.language, sandbox, {
        input: testCase.input,
        timeoutMs: problem.timeLimitMs,
      });
      maxRuntimeMs = Math.max(maxRuntimeMs, runResult.durationMs || 0);
      if (runResult.memoryKb) maxMemoryKb = Math.max(maxMemoryKb, runResult.memoryKb);

      const comparisonResult = compare(runResult.stdout, testCase.expectedOutput);
      outcome = verdict({ compileResult, runResult, comparisonResult });

      if (!outcome.passed) {
        failedTestIndex = i;
        break; // early termination — the failing verdict is final.
      }
    }

    // 7. Persist the final verdict + aggregate metrics.
    logger.info('Judging finished; finalizing', {
      submissionId,
      verdict: outcome.verdict,
      failedTestIndex,
    });
    await submissions.completeSubmission(submissionId, {
      verdict: outcome.verdict,
      compileOutput: null,
      runtimeMs: maxRuntimeMs,
      memoryKb: maxMemoryKb || null,
      failedTestIndex,
    });
    return outcome;
  } finally {
    // 8. Always destroy the container + workspace, even on error.
    await docker.cleanup(sandbox);
  }
}

module.exports = { runJudgePipeline, LANGUAGE_IMAGES };
