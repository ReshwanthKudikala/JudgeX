// Verdict engine: collapses the pipeline's stage signals into exactly one verdict.
//
// PURE FUNCTION. It reads compile/run/comparison results and returns a plain
// object. It does not touch the database, submissions, the queue, Docker, or
// repositories, and has no side effects — the same inputs always yield the same
// output.
//
// Verdict values align with DATABASE_DESIGN.md §3.7 + Sprint 25 extensions:
// compile_error, memory_limit_exceeded, runtime_error, tle, wrong_answer,
// accepted, internal_error.

const VERDICTS = Object.freeze({
  COMPILE_ERROR: 'compile_error',
  MEMORY_LIMIT_EXCEEDED: 'memory_limit_exceeded',
  RUNTIME_ERROR: 'runtime_error',
  TLE: 'tle',
  WRONG_ANSWER: 'wrong_answer',
  ACCEPTED: 'accepted',
  INTERNAL_ERROR: 'internal_error',
});

/**
 * Generate exactly one verdict from the stage results, applying the fixed
 * precedence (first match wins):
 *   1. compile failed          → compile_error
 *   2. execution timed out      → tle
 *   3. OOM killed               → memory_limit_exceeded
 *   4. non-zero exit code       → runtime_error
 *   5. output mismatch          → wrong_answer
 *   6. otherwise                → accepted
 *
 * @param {object} input
 * @param {object} [input.compileResult] - { success, ... } from the compiler.
 * @param {object} [input.runResult] - { exitCode, timedOut, oomKilled, durationMs, memoryKb } from the runner.
 * @param {object} [input.comparisonResult] - { matches } from the comparator.
 * @returns {{ verdict: string, passed: boolean, metrics: { runtimeMs: number|null, memoryKb: number|null } }}
 */
function generateVerdict({ compileResult, runResult, comparisonResult } = {}) {
  const metrics = {
    runtimeMs: runResult && runResult.durationMs !== undefined ? runResult.durationMs : null,
    memoryKb: runResult && runResult.memoryKb !== undefined ? runResult.memoryKb : null,
  };

  let verdict;
  if (compileResult && compileResult.success === false) {
    verdict = VERDICTS.COMPILE_ERROR;
  } else if (runResult && runResult.timedOut === true) {
    verdict = VERDICTS.TLE;
  } else if (runResult && runResult.oomKilled === true) {
    verdict = VERDICTS.MEMORY_LIMIT_EXCEEDED;
  } else if (runResult && typeof runResult.exitCode === 'number' && runResult.exitCode !== 0) {
    // Only a concrete non-zero exit is RE. null/undefined must not count as RE
    // (that previously turned attach/inspect races into false runtime errors).
    verdict = VERDICTS.RUNTIME_ERROR;
  } else if (comparisonResult && comparisonResult.matches === false) {
    verdict = VERDICTS.WRONG_ANSWER;
  } else {
    verdict = VERDICTS.ACCEPTED;
  }

  return {
    verdict,
    passed: verdict === VERDICTS.ACCEPTED,
    metrics,
  };
}

module.exports = { generateVerdict, VERDICTS };
