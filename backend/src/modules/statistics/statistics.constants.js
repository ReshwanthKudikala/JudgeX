// Shared constants for ranking / timeframe windows (Sprint 27).

const TIMEFRAMES = Object.freeze(['all', 'monthly', 'weekly']);

/** Map timeframe → Postgres interval expression (null = unbounded / all-time). */
function timeframeInterval(timeframe) {
  switch (timeframe) {
    case 'weekly':
      return '7 days';
    case 'monthly':
      return '30 days';
    case 'all':
    default:
      return null;
  }
}

/**
 * Compute a display score from solved count + acceptance rate.
 * Higher is better; used for UI — ranking still uses the multi-key ORDER BY.
 */
function computeScore(problemsSolved, acceptanceRate) {
  const solved = Number(problemsSolved) || 0;
  const rate = Number(acceptanceRate) || 0;
  return Math.round(solved * 100 + rate);
}

module.exports = { TIMEFRAMES, timeframeInterval, computeScore };
