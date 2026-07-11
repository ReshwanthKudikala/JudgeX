// Public types / result shapes for the AI module.

/**
 * @typedef {object} CompileExplanation
 * @property {string} explanation - short plain-language summary.
 * @property {string} likelyCause - most likely root cause.
 * @property {string} possibleFix - high-level fix direction (no full code).
 * @property {boolean} wasBlocked - true when output guardrails replaced the reply.
 * @property {string} [provider] - which adapter produced the text.
 */

module.exports = {};
