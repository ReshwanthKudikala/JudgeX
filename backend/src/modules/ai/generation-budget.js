/**
 * Output-token caps per coach action.
 * Measured on this machine: qwen2.5-coder:7b generates about 7 tokens/second
 * because most of the model is off the 4 GB GPU. A shorter cap is the
 * generation-time limit. The configured OLLAMA_NUM_PREDICT ceiling still wins
 * when it is lower.
 */

const ACTION_PREDICT = Object.freeze({
  // A complete explain on this model stopped at 896 tokens. 1024 leaves
  // that room. A 420 cap was measured to cut the answer off (done=length).
  EXPLAIN_CODE: 1024,
  REVIEW: 480,
  HINT: 200,
  COMPLEXITY: 160,
  COMPILE_ERROR: 360,
  WRONG_ANSWER: 400,
  OPTIMIZE: 420,
  UNKNOWN: 480,
});

/**
 * @param {string} action
 * @param {number} [ceiling]
 */
function numPredictForAction(action, ceiling = 1024) {
  const cap = ACTION_PREDICT[action] || 400;
  const limit = Number.isFinite(ceiling) && ceiling > 0 ? ceiling : cap;
  return Math.max(32, Math.min(cap, limit));
}

module.exports = {
  ACTION_PREDICT,
  numPredictForAction,
};
