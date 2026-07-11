const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generateVerdict, VERDICTS } = require('../../../src/modules/judge/verdict-engine');

describe('generateVerdict', () => {
  it('returns compile_error when compilation fails', () => {
    const result = generateVerdict({ compileResult: { success: false } });
    assert.equal(result.verdict, VERDICTS.COMPILE_ERROR);
    assert.equal(result.passed, false);
  });

  it('returns tle before oom when timed out', () => {
    const result = generateVerdict({
      compileResult: { success: true },
      runResult: { timedOut: true, oomKilled: true, exitCode: 137, durationMs: 2000 },
    });
    assert.equal(result.verdict, VERDICTS.TLE);
  });

  it('returns memory_limit_exceeded on OOM', () => {
    const result = generateVerdict({
      compileResult: { success: true },
      runResult: { timedOut: false, oomKilled: true, exitCode: 137, durationMs: 10 },
    });
    assert.equal(result.verdict, VERDICTS.MEMORY_LIMIT_EXCEEDED);
    assert.equal(result.passed, false);
  });

  it('returns runtime_error on non-zero exit', () => {
    const result = generateVerdict({
      compileResult: { success: true },
      runResult: { timedOut: false, oomKilled: false, exitCode: 1, durationMs: 5 },
    });
    assert.equal(result.verdict, VERDICTS.RUNTIME_ERROR);
  });

  it('returns wrong_answer on mismatch', () => {
    const result = generateVerdict({
      compileResult: { success: true },
      runResult: { timedOut: false, oomKilled: false, exitCode: 0, durationMs: 5 },
      comparisonResult: { matches: false },
    });
    assert.equal(result.verdict, VERDICTS.WRONG_ANSWER);
  });

  it('returns accepted when all stages pass', () => {
    const result = generateVerdict({
      compileResult: { success: true },
      runResult: { timedOut: false, oomKilled: false, exitCode: 0, durationMs: 5, memoryKb: 1024 },
      comparisonResult: { matches: true },
    });
    assert.equal(result.verdict, VERDICTS.ACCEPTED);
    assert.equal(result.passed, true);
    assert.equal(result.metrics.memoryKb, 1024);
  });
});
