/**
 * Instruction coverage for coach prompts and replies.
 * Pure helpers: no model calls, no logging of prompts or code.
 */

const TRUNCATION_NOTICE =
  '\n\n> This answer was cut off before it finished. It may not cover everything you asked.';

const MAX_REQUESTED_INPUTS = 12;

/**
 * Inputs the user asked to trace or check.
 * Prefers short backtick spans. Also accepts a comma-separated integer list
 * of at least three values, including a trailing "and".
 * @param {unknown} message
 * @returns {string[]}
 */
function extractRequestedInputs(message) {
  if (typeof message !== 'string' || !message.trim()) return [];
  /** @type {string[]} */
  const found = [];

  const push = (raw) => {
    const value = String(raw).trim();
    if (!value || value.length > 40 || found.includes(value)) return;
    if (found.length >= MAX_REQUESTED_INPUTS) return;
    found.push(value);
  };

  const tick = /`([^`\n]{1,40})`/g;
  let match = tick.exec(message);
  while (match) {
    const value = match[1].trim();
    if (!/[{};]|#include|\bint\b|\bcout\b/.test(value)) push(value);
    match = tick.exec(message);
  }
  if (found.length >= 2) return found;

  const lists = message.matchAll(
    /(?:^|[^\d-])(-?\d+(?:\s*,\s*(?:and\s+)?-?\d+){2,})/g,
  );
  for (const list of lists) {
    for (const part of list[1].split(/\s*,\s*(?:and\s+)?/)) push(part);
  }
  if (found.length === 0) {
    for (const named of message.matchAll(/\b(?:input|trace|check|example)\s+(-?\d+)\b/gi)) {
      push(named[1]);
    }
  }
  return found;
}

/**
 * @param {string} answer
 * @param {string} item
 */
function answerMentionsInput(answer, item) {
  if (/^-?\d+$/.test(item)) {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(answer);
  }
  return answer.includes(item);
}

/**
 * @param {unknown} message
 * @param {unknown} answer
 * @returns {string[]}
 */
function missingRequestedInputs(message, answer) {
  const requested = extractRequestedInputs(message);
  if (requested.length < 1) return [];
  const text = typeof answer === 'string' ? answer : '';
  return requested.filter((item) => !answerMentionsInput(text, item));
}

/**
 * @param {string[]} inputs
 * @returns {string}
 */
function formatRequiredCoverage(inputs) {
  if (!inputs || inputs.length < 1) return '';
  const lines = inputs.map((item, index) => `${index + 1}. \`${item}\``);
  return [
    'Address every item below, in order. Do not stop after a subset.',
    'For each item, quote the source line that decides it, then the result.',
    'If that line is not in the current source, say the case is not handled. Do not invent a check.',
    'If you cannot finish, end with "Not covered:" and the remaining items.',
    ...lines,
  ].join('\n');
}

/**
 * @param {unknown} message
 */
function challengesPriorClaim(message) {
  if (typeof message !== 'string') return false;
  return /re-?evaluate|incorrect|you were wrong|earlier (review|claim|answer)|mistake|not true|that(?:'s| is) wrong/i.test(
    message,
  );
}

/**
 * @param {string} answer
 */
function appendTruncationNotice(answer) {
  const text = typeof answer === 'string' ? answer : '';
  if (text.includes('This answer was cut off before it finished')) return text;
  return `${text.trimEnd()}${TRUNCATION_NOTICE}`;
}

/**
 * @param {string} answer
 * @param {string[]} missing
 */
function appendMissingCoverage(answer, missing) {
  if (!missing || missing.length === 0) return answer;
  const text = typeof answer === 'string' ? answer : '';
  if (text.includes('> Not covered:')) return text;
  const line = missing.map((item) => `\`${item}\``).join(', ');
  return `${text.trimEnd()}\n\n> Not covered: ${line}. This reply did not address every requested input.`;
}

/**
 * @param {unknown} history
 * @returns {{ role: 'user' | 'assistant', content: string }[]}
 */
function sanitizeCoachHistory(history) {
  if (!Array.isArray(history)) return [];
  /** @type {{ role: 'user' | 'assistant', content: string }[]} */
  const turns = [];
  for (const turn of history) {
    if (!turn || typeof turn !== 'object') continue;
    const role =
      turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null;
    if (!role) continue;
    const content = typeof turn.content === 'string' ? turn.content.trim() : '';
    if (!content) continue;
    turns.push({ role, content: content.slice(0, 1500) });
  }
  return turns.slice(-6);
}

module.exports = {
  TRUNCATION_NOTICE,
  extractRequestedInputs,
  answerMentionsInput,
  missingRequestedInputs,
  formatRequiredCoverage,
  challengesPriorClaim,
  appendTruncationNotice,
  appendMissingCoverage,
  sanitizeCoachHistory,
};
