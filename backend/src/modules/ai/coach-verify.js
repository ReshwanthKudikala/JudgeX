/**
 * Execution evidence for a coach review.
 * Plans a few public or user-named inputs and formats sandbox results.
 * Does not run code itself and does not load hidden tests.
 */

const { normalizeOutput } = require('../judge/comparator');
const { extractRequestedInputs } = require('./coach-instruction');

const MAX_CASES = 8;
const MAX_INPUT_CHARS = 200;
const VERIFY_WAIT_MS = 20_000;

/**
 * @param {unknown} value
 */
function caseKey(value) {
  return String(value == null ? '' : value).trim();
}

/**
 * @param {string} input
 * @param {string|null} expected
 * @param {string} label
 * @param {Array<object>} cases
 * @param {Set<string>} seen
 */
function addCase(input, expected, label, cases, seen) {
  const raw = String(input == null ? '' : input);
  if (!raw.trim() || raw.length > MAX_INPUT_CHARS || raw.includes('\0')) return;
  const key = caseKey(raw);
  if (!key || seen.has(key) || cases.length >= MAX_CASES) return;
  seen.add(key);
  cases.push({
    input: raw.endsWith('\n') ? raw : `${raw}\n`,
    expectedOutput: expected == null ? null : String(expected),
    label: label || key,
  });
}

/**
 * Public examples first, then short inputs named in the user message.
 * Expected output is attached only when a public example already has it.
 * @param {{ message?: string, examples?: Array<{ input?: string, output?: string, expectedOutput?: string }> }} src
 */
function selectVerificationCases(src) {
  const cases = [];
  const seen = new Set();
  const expectedByInput = new Map();
  for (const example of src.examples || []) {
    const label = caseKey(example.input);
    const expected = example.output ?? example.expectedOutput ?? null;
    if (label && expected != null) expectedByInput.set(label, String(expected));
    addCase(example.input, expected, label, cases, seen);
  }
  for (const item of extractRequestedInputs(src.message)) {
    if (item.length > 40) continue;
    addCase(item, expectedByInput.get(item) ?? null, item, cases, seen);
  }
  return cases;
}

/**
 * @param {string} action
 * @param {number} caseCount
 */
function shouldVerifyExecution(action, caseCount) {
  if (action === 'HINT' || action === 'COMPILE_ERROR' || action === 'EXPLAIN_CODE') {
    return false;
  }
  if (action === 'REVIEW') return caseCount > 0;
  return caseCount > 0 && action !== 'OPTIMIZE' && action !== 'COMPLEXITY';
}

/**
 * @param {object|null} run
 * @param {Array<{ label: string }>} cases
 */
function evidenceFromRun(run, cases) {
  if (!run || run.status === 'compile_error' || run.compile?.success === false) {
    return {
      status: 'compile_error',
      results: [],
    };
  }
  const results = (run.results || []).map((row, index) => ({
    label: cases[index]?.label || caseKey(row.input),
    printed: row.timedOut ? null : normalizeOutput(row.actualOutput),
    expected: row.expectedOutput == null ? null : normalizeOutput(row.expectedOutput),
    timedOut: Boolean(row.timedOut),
    exitCode: row.exitCode ?? null,
  }));
  return { status: 'verified', results };
}

/**
 * @param {object} evidence
 */
function formatVerificationPrompt(evidence) {
  if (!evidence || evidence.status === 'skipped') return '';
  if (evidence.status === 'unavailable') {
    return 'Verified execution: unavailable. Do not state what this source prints.';
  }
  if (evidence.status === 'compile_error') {
    return 'Verified execution: the source did not compile in the sandbox. Do not invent runtime traces.';
  }
  const lines = evidence.results.map((row) => {
    if (row.timedOut) return `- \`${row.label}\`: timed out`;
    const expected = row.expected == null ? '' : `; expected \`${row.expected}\``;
    return `- \`${row.label}\`: printed \`${row.printed}\`${expected}`;
  });
  return [
    'Verified execution from the sandbox. These lines are facts. Do not contradict them.',
    ...lines,
  ].join('\n');
}

/**
 * @param {string} answer
 * @param {object} evidence
 */
function appendVerificationFooter(answer, evidence) {
  const text = typeof answer === 'string' ? answer : '';
  if (!evidence || evidence.status === 'skipped' || text.includes('> Verified:')) {
    return text;
  }
  let block = '';
  if (evidence.status === 'unavailable') {
    block = '> Verified execution: unavailable. Runtime claims above were not checked.';
  } else if (evidence.status === 'compile_error') {
    block = '> Verified execution: the source did not compile. Runtime behavior was not checked.';
  } else if (evidence.status === 'verified') {
    block = evidence.results
      .map((row) => {
        if (row.timedOut) return `> Verified: \`${row.label}\` timed out`;
        const expected = row.expected == null ? '' : `; expected \`${row.expected}\``;
        return `> Verified: \`${row.label}\` printed \`${row.printed}\`${expected}`;
      })
      .join('\n');
  }
  if (!block) return text;
  return `${text.trimEnd()}\n\n${block}`;
}

/**
 * Default verifier: one Run job on the judge worker. No submission row.
 * @param {{ problemId: string, language: string, sourceCode: string, cases: object[] }} request
 */
async function verifyCoachExecution(request) {
  const { enqueueRunAndWait } = require('../../infrastructure/queue/queue.service');
  const run = await enqueueRunAndWait(
    {
      problemId: request.problemId,
      language: request.language,
      sourceCode: request.sourceCode,
      cases: request.cases.map((item) => ({
        input: item.input,
        expectedOutput: item.expectedOutput,
      })),
    },
    { timeoutMs: VERIFY_WAIT_MS },
  );
  return evidenceFromRun(run, request.cases);
}

module.exports = {
  MAX_CASES,
  selectVerificationCases,
  shouldVerifyExecution,
  evidenceFromRun,
  formatVerificationPrompt,
  appendVerificationFooter,
  verifyCoachExecution,
};
