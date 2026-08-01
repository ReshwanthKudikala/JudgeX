/**
 * Sprint 45 — Wrong Answer Debugger helpers.
 */

const { COACH_ACTIONS } = require('./coach.actions');

const NO_PUBLIC_FAILURE_MESSAGE =
  'Debugging a Wrong Answer needs a public failing test case (with expected vs actual output). Run against the public samples first, or open a submission that failed on a visible sample — hidden judge failures cannot be inspected.';

const WRONG_ANSWER_SECTIONS = Object.freeze([
  'Likely Cause',
  'What the Public Test Case Shows',
  'Where To Look',
  'Common Edge Cases',
  'Suggested Debugging Steps',
  'Learning Tip',
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isWrongAnswerStatus(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return v === 'wrong_answer' || v === 'wa';
}

/**
 * Public cases that failed (passed === false).
 * @param {object|null|undefined} lastRunResult
 * @returns {object[]}
 */
function findPublicFailingCases(lastRunResult) {
  if (!lastRunResult || !Array.isArray(lastRunResult.results)) return [];
  return lastRunResult.results.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return row.passed === false;
  });
}

/**
 * True when run/submit context indicates a Wrong Answer.
 * @param {{ lastRunResult?: object|null, lastSubmission?: object|null }} ctx
 */
function hasWrongAnswerSignal(ctx) {
  const run = ctx.lastRunResult;
  const sub = ctx.lastSubmission;
  if (isWrongAnswerStatus(run?.status)) return true;
  if (isWrongAnswerStatus(sub?.verdict)) return true;
  if (findPublicFailingCases(run).length > 0) return true;
  return false;
}

/**
 * True when we have at least one public failing case with I/O to discuss.
 * @param {{ lastRunResult?: object|null }} ctx
 */
function hasPublicFailingTestcase(ctx) {
  const failing = findPublicFailingCases(ctx.lastRunResult);
  return failing.some(
    (row) =>
      (typeof row.expectedOutput === 'string' && row.expectedOutput.length > 0) ||
      (typeof row.actualOutput === 'string' && row.actualOutput.length > 0) ||
      (typeof row.input === 'string' && row.input.length > 0),
  );
}

/**
 * Compact public failure payload for the prompt (already sanitized).
 * @param {object|null|undefined} lastRunResult
 */
function buildPublicFailureContext(lastRunResult) {
  return findPublicFailingCases(lastRunResult).map((row, i) => ({
    caseIndex: row.index ?? i,
    input: row.input ?? null,
    expectedOutput: row.expectedOutput ?? null,
    actualOutput: row.actualOutput ?? null,
    runtimeMs: row.runtimeMs ?? null,
    status: row.status ?? 'wrong_answer',
  }));
}

/**
 * @param {string} raw
 * @param {{ action?: string }} [opts]
 */
function mapWrongAnswerMarkdownAnswer(raw, opts = {}) {
  let text = typeof raw === 'string' ? raw.trim() : '';

  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  text = text.replace(/^#{1,3}\s*Likely Cause\s*$/im, '# Likely Cause');

  const sectionsFound = WRONG_ANSWER_SECTIONS.filter((name) => {
    const re = new RegExp(
      `^#{1,3}\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'im',
    );
    return re.test(text);
  });

  if (opts.action === COACH_ACTIONS.WRONG_ANSWER && !text.startsWith('#')) {
    text = `# Likely Cause\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    sectionsFound,
  };
}

module.exports = {
  NO_PUBLIC_FAILURE_MESSAGE,
  WRONG_ANSWER_SECTIONS,
  isWrongAnswerStatus,
  findPublicFailingCases,
  hasWrongAnswerSignal,
  hasPublicFailingTestcase,
  buildPublicFailureContext,
  mapWrongAnswerMarkdownAnswer,
};
