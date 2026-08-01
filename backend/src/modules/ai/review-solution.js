/**
 * Sprint 43 — Review My Solution helpers.
 */

const { COACH_ACTIONS } = require('./coach.actions');
const { isCoachCodeEmpty } = require('./explain-code');

const EMPTY_REVIEW_CODE_MESSAGE =
  'Write some code in the editor first, then click “Review My Solution” for interviewer-style feedback.';

const REVIEW_SECTIONS = Object.freeze([
  'Overall Review',
  'What You Did Well',
  'Areas for Improvement',
  'Readability',
  'Edge Cases',
  'Interview Feedback',
  'Final Rating',
  'Learning Tip',
]);

/**
 * Actions that require non-empty source before calling the provider.
 * @param {string} action
 */
function requiresSourceCode(action) {
  return (
    action === COACH_ACTIONS.EXPLAIN_CODE ||
    action === COACH_ACTIONS.REVIEW ||
    action === COACH_ACTIONS.WRONG_ANSWER ||
    action === COACH_ACTIONS.OPTIMIZE
  );
}

/**
 * @param {string} action
 * @returns {string}
 */
function emptyCodeMessageForAction(action) {
  if (action === COACH_ACTIONS.REVIEW) return EMPTY_REVIEW_CODE_MESSAGE;
  if (action === COACH_ACTIONS.WRONG_ANSWER) {
    return 'Write some code in the editor first, then click “Debug Wrong Answer”.';
  }
  if (action === COACH_ACTIONS.OPTIMIZE) {
    const { EMPTY_OPTIMIZE_CODE_MESSAGE } = require('./optimize-coach');
    return EMPTY_OPTIMIZE_CODE_MESSAGE;
  }
  return 'Write some code in the editor first, then click “Explain My Code” and I will walk through your solution.';
}

/**
 * Normalize Review (and shared) Markdown for the AI panel.
 * @param {string} raw
 * @param {{ action?: string }} [opts]
 */
function mapReviewMarkdownAnswer(raw, opts = {}) {
  let text = typeof raw === 'string' ? raw.trim() : '';

  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  text = text.replace(/^#{1,3}\s*Overall Review\s*$/im, '# Overall Review');
  text = text.replace(/^#{1,3}\s*Final Rating\s*$/im, '# Final Rating');

  const sectionsFound = REVIEW_SECTIONS.filter((name) => {
    const re = new RegExp(
      `^#{1,3}\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'im',
    );
    return re.test(text);
  });

  if (opts.action === COACH_ACTIONS.REVIEW && !text.startsWith('#')) {
    text = `# Overall Review\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    sectionsFound,
  };
}

module.exports = {
  EMPTY_REVIEW_CODE_MESSAGE,
  REVIEW_SECTIONS,
  requiresSourceCode,
  emptyCodeMessageForAction,
  mapReviewMarkdownAnswer,
  isCoachCodeEmpty,
};
