/**
 * Sprint 42 — Explain My Code helpers (reference action implementation).
 */

const { COACH_ACTIONS } = require('./coach.actions');

const EMPTY_CODE_MESSAGE =
  'Write some code in the editor first, then click “Explain My Code” and I will walk through your solution.';

const EXPLAIN_CODE_SECTIONS = Object.freeze([
  'Overview',
  'Step-by-step Explanation',
  'Time Complexity',
  'Space Complexity',
  'Strengths',
  'Possible Weaknesses',
  'Learning Tip',
]);

/**
 * @param {unknown} code
 * @returns {boolean}
 */
function isCoachCodeEmpty(code) {
  if (typeof code !== 'string') return true;
  return code.trim().length === 0;
}

/**
 * Normalize model output into clean Markdown for the AI panel.
 * @param {string} raw
 * @param {{ action?: string }} [opts]
 * @returns {{ answer: string, format: 'markdown', sectionsFound: string[] }}
 */
function mapCoachMarkdownAnswer(raw, opts = {}) {
  if (opts.action === COACH_ACTIONS.REVIEW) {
    const { mapReviewMarkdownAnswer } = require('./review-solution');
    return mapReviewMarkdownAnswer(raw, opts);
  }

  if (opts.action === COACH_ACTIONS.HINT) {
    const { mapHintMarkdownAnswer } = require('./progressive-hint');
    return mapHintMarkdownAnswer(raw, opts);
  }

  let text = typeof raw === 'string' ? raw.trim() : '';

  // Strip a single outer markdown fence if the model wrapped the whole reply.
  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  // Normalize "Overview" variants to the required H1 when present.
  text = text.replace(/^#{1,3}\s*Overview\s*$/im, '# Overview');

  const sectionsFound = EXPLAIN_CODE_SECTIONS.filter((name) => {
    const re = new RegExp(`^#{1,3}\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
    return re.test(text);
  });

  if (opts.action === COACH_ACTIONS.EXPLAIN_CODE && !text.startsWith('#')) {
    // Soft wrap plain text so MarkdownRenderer still looks decent.
    text = `# Overview\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    sectionsFound,
  };
}

/**
 * Friendly provider error copy for the coach API.
 * @param {unknown} err
 * @returns {{ message: string, code: string } | null}
 */
function mapCoachProviderError(err) {
  if (!err || typeof err !== 'object') return null;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return {
      code: 'AI_TIMEOUT',
      message:
        'The AI coach timed out. Please try again in a moment.',
    };
  }

  if (
    lower.includes('unavailable') ||
    lower.includes('failed') ||
    lower.includes('empty completion')
  ) {
    return {
      code: 'AI_UNAVAILABLE',
      message:
        'The local AI model is unavailable right now. Check that Ollama is running, then try again.',
    };
  }

  return null;
}

module.exports = {
  EMPTY_CODE_MESSAGE,
  EXPLAIN_CODE_SECTIONS,
  isCoachCodeEmpty,
  mapCoachMarkdownAnswer,
  mapCoachProviderError,
};
