// Normalizes and compares program output against expected output.
//
// SCOPE: pure, side-effect-free text comparison. It normalizes both sides per
// the tolerance rules (PRD FR-JUDGE-11 / JUDGE_PIPELINE.md §4) and reports whether
// they are exactly equal after normalization. It does NOT produce verdicts
// (WA/AC), inspect exit codes or timeouts, or touch the runner/Docker/DB.

/**
 * Normalize program output for tolerant exact-match comparison:
 *   - convert CRLF / lone CR to LF
 *   - strip trailing whitespace on each line
 *   - drop trailing blank lines at end-of-output
 *   - preserve meaningful leading/internal whitespace
 *
 * @param {string|Buffer|null|undefined} output
 * @returns {string} normalized text.
 */
function normalizeOutput(output) {
  if (output === null || output === undefined) return '';

  const text = String(output)
    .replace(/\r\n/g, '\n') // Windows CRLF → LF
    .replace(/\r/g, '\n'); // stray CR → LF

  // Trim trailing whitespace (spaces/tabs, not the newline) on every line.
  const lines = text.split('\n').map((line) => line.replace(/[^\S\n]+$/, ''));

  // Ignore trailing blank lines at EOF.
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Normalize both sides and compare for exact equality.
 *
 * @param {string|Buffer|null|undefined} actual - program stdout.
 * @param {string|Buffer|null|undefined} expected - expected output.
 * @returns {{ matches: boolean, actual: string, expected: string }}
 *          `actual`/`expected` are the NORMALIZED forms. No verdict.
 */
function compareOutputs(actual, expected) {
  const normalizedActual = normalizeOutput(actual);
  const normalizedExpected = normalizeOutput(expected);
  return {
    matches: normalizedActual === normalizedExpected,
    actual: normalizedActual,
    expected: normalizedExpected,
  };
}

module.exports = { normalizeOutput, compareOutputs };
