/**
 * Sprint 44 — Progressive Hint System helpers.
 */

const { COACH_ACTIONS } = require('./coach.actions');

const MIN_HINT_LEVEL = 1;
const MAX_HINT_LEVEL = 3;

const REVEAL_EDITORIAL_MESSAGE =
  'Would you like to open the Editorial instead?';

/**
 * @param {unknown} raw
 * @returns {number}
 * @throws {{ code: string, message: string }}
 */
function parseHintLevel(raw) {
  const n = typeof raw === 'string' ? Number(raw) : Number(raw);
  if (!Number.isInteger(n) || n < MIN_HINT_LEVEL || n > MAX_HINT_LEVEL) {
    const err = new Error(
      `hintLevel must be an integer between ${MIN_HINT_LEVEL} and ${MAX_HINT_LEVEL}.`,
    );
    err.code = 'INVALID_HINT_LEVEL';
    throw err;
  }
  return n;
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
function coerceHintLevel(raw) {
  if (raw == null || raw === '') return null;
  try {
    return parseHintLevel(raw);
  } catch {
    return null;
  }
}

/**
 * Level descriptions injected into the user prompt.
 * @param {number} level
 */
function hintLevelGuidance(level) {
  const map = {
    1: 'Level 1 — Subtle: guide thinking only; do not name a specific algorithm unless absolutely necessary.',
    2: 'Level 2 — Concrete: mention an appropriate data structure or technique; still no full walkthrough.',
    3: 'Level 3 — Almost enough: explain the approach clearly in words; still DO NOT generate code.',
  };
  return map[level] || map[1];
}

/**
 * Normalize hint Markdown.
 * @param {string} raw
 * @param {{ hintLevel?: number }} [opts]
 */
function mapHintMarkdownAnswer(raw, opts = {}) {
  let text = typeof raw === 'string' ? raw.trim() : '';

  const outerFence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  const level = opts.hintLevel;
  if (level && !/^#\s*Hint/im.test(text)) {
    text = `# Hint ${level}\n\n${text}`;
  }

  return {
    answer: text,
    format: 'markdown',
    hintLevel: level ?? null,
  };
}

module.exports = {
  MIN_HINT_LEVEL,
  MAX_HINT_LEVEL,
  REVEAL_EDITORIAL_MESSAGE,
  parseHintLevel,
  coerceHintLevel,
  hintLevelGuidance,
  mapHintMarkdownAnswer,
  COACH_ACTIONS,
};
