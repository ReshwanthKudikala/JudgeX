/**
 * Sprint 41 — AI Learning Coach action definitions (Phase 1).
 * Prompt selection only; no per-action product logic yet.
 */

/** @typedef {'EXPLAIN_CODE'|'REVIEW'|'COMPLEXITY'|'COMPILE_ERROR'|'WRONG_ANSWER'|'OPTIMIZE'|'HINT'|'UNKNOWN'} CoachAction */

const COACH_ACTIONS = Object.freeze({
  EXPLAIN_CODE: 'EXPLAIN_CODE',
  REVIEW: 'REVIEW',
  COMPLEXITY: 'COMPLEXITY',
  COMPILE_ERROR: 'COMPILE_ERROR',
  WRONG_ANSWER: 'WRONG_ANSWER',
  OPTIMIZE: 'OPTIMIZE',
  HINT: 'HINT',
  UNKNOWN: 'UNKNOWN',
});

/** @type {readonly CoachAction[]} */
const COACH_ACTION_LIST = Object.freeze(Object.values(COACH_ACTIONS));

/**
 * Normalize client / legacy action strings into a CoachAction.
 * @param {unknown} raw
 * @returns {CoachAction}
 */
function resolveCoachAction(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return COACH_ACTIONS.UNKNOWN;
  }

  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (COACH_ACTION_LIST.includes(/** @type {CoachAction} */ (key))) {
    return /** @type {CoachAction} */ (key);
  }

  // Legacy learning-assist aliases → coach actions
  const legacy = raw.trim().toLowerCase();
  const map = {
    explain_code: COACH_ACTIONS.EXPLAIN_CODE,
    review: COACH_ACTIONS.REVIEW,
    complexity: COACH_ACTIONS.COMPLEXITY,
    analyze_complexity: COACH_ACTIONS.COMPLEXITY,
    compile_error: COACH_ACTIONS.COMPILE_ERROR,
    wrong_answer: COACH_ACTIONS.WRONG_ANSWER,
    why_failed: COACH_ACTIONS.WRONG_ANSWER,
    explain_verdict: COACH_ACTIONS.WRONG_ANSWER,
    optimize: COACH_ACTIONS.OPTIMIZE,
    suggest_optimizations: COACH_ACTIONS.OPTIMIZE,
    hint: COACH_ACTIONS.HINT,
    generate_hint: COACH_ACTIONS.HINT,
    ask: COACH_ACTIONS.UNKNOWN,
    unknown: COACH_ACTIONS.UNKNOWN,
  };

  return map[legacy] || COACH_ACTIONS.UNKNOWN;
}

module.exports = {
  COACH_ACTIONS,
  COACH_ACTION_LIST,
  resolveCoachAction,
};
