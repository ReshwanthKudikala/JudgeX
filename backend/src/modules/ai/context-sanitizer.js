/**
 * Strip anything that must never reach the model (hidden judge data).
 */

const HIDDEN_KEY_RE =
  /^(hidden|judge|secret|private).*$|.*(hidden|secret).*(input|output|expected|actual|stdout|stdin|cases?|count|metadata).*$/i;

const FORBIDDEN_KEYS = new Set([
  'hiddenTests',
  'hiddenTestcases',
  'hiddenTestCases',
  'judgeTests',
  'privateTests',
  'secretTests',
  'judgeInput',
  'hiddenInput',
  'hiddenOutput',
  'hiddenExpected',
  'hiddenActual',
  'hiddenCount',
  'totalHidden',
  'hiddenTestCount',
  'hiddenTestcaseCount',
  'judgeTestCount',
]);

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function deepSanitize(value, depth = 0) {
  if (depth > 8) return undefined;
  if (value == null) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => deepSanitize(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key) || HIDDEN_KEY_RE.test(key)) {
      continue;
    }
    // Never forward raw case visibility flags that imply hidden rows.
    if (key === 'isHidden' || key === 'hidden' || key === 'visibility') {
      continue;
    }
    const cleaned = deepSanitize(raw, depth + 1);
    if (cleaned !== undefined) {
      out[key] = cleaned;
    }
  }
  return out;
}

/**
 * Keep only public run-case fields.
 * @param {unknown} results
 */
function sanitizePublicResults(results) {
  if (!Array.isArray(results)) return [];
  return results
    .filter((row) => {
      if (!row || typeof row !== 'object') return false;
      const r = /** @type {Record<string, unknown>} */ (row);
      if (r.isHidden === true || r.hidden === true) return false;
      if (r.visibility === 'hidden' || r.visibility === 'private') return false;
      return true;
    })
    .map((row) => {
      const r = /** @type {Record<string, unknown>} */ (row);
      return {
        index: r.index ?? r.caseIndex ?? null,
        status: r.status ?? r.verdict ?? null,
        passed: r.passed ?? null,
        input: typeof r.input === 'string' ? r.input : null,
        expectedOutput:
          typeof r.expectedOutput === 'string'
            ? r.expectedOutput
            : typeof r.expected === 'string'
              ? r.expected
              : null,
        actualOutput:
          typeof r.actualOutput === 'string'
            ? r.actualOutput
            : typeof r.stdout === 'string'
              ? r.stdout
              : null,
        stderr: typeof r.stderr === 'string' ? r.stderr : null,
        runtimeMs: r.runtimeMs ?? r.executionTime ?? null,
      };
    });
}

/**
 * Sanitize optional lastRunResult from the client.
 * @param {unknown} raw
 */
function sanitizeLastRunResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const compile =
    r.compile && typeof r.compile === 'object'
      ? {
          success: /** @type {Record<string, unknown>} */ (r.compile).success ?? null,
          stdout: null, // avoid leaking large/internal streams
          stderr:
            typeof /** @type {Record<string, unknown>} */ (r.compile).stderr === 'string'
              ? /** @type {Record<string, unknown>} */ (r.compile).stderr
              : null,
        }
      : null;

  return {
    status: typeof r.status === 'string' ? r.status : null,
    compileSuccess: r.compileSuccess ?? compile?.success ?? null,
    stderr: typeof r.stderr === 'string' ? r.stderr : compile?.stderr ?? null,
    compile,
    results: sanitizePublicResults(r.results),
    passedCount: typeof r.passedCount === 'number' ? r.passedCount : null,
    totalCount: typeof r.totalCount === 'number' ? r.totalCount : null,
  };
}

/**
 * Sanitize optional lastSubmission summary from the client.
 * Never includes per-case I/O (hidden or otherwise).
 * @param {unknown} raw
 */
function sanitizeLastSubmission(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  return {
    id: typeof r.id === 'string' ? r.id : null,
    status: typeof r.status === 'string' ? r.status : null,
    verdict: typeof r.verdict === 'string' ? r.verdict : null,
    compileOutput: typeof r.compileOutput === 'string' ? r.compileOutput : null,
    stderr: typeof r.stderr === 'string' ? r.stderr : null,
    executionError: typeof r.executionError === 'string' ? r.executionError : null,
    runtimeMs: r.runtimeMs ?? r.executionTime ?? null,
    memoryKb: r.memoryKb ?? null,
    passedTests: typeof r.passedTests === 'number' ? r.passedTests : null,
    totalTests: typeof r.totalTests === 'number' ? r.totalTests : null,
    failedTestIndex:
      typeof r.failedTestIndex === 'number' ? r.failedTestIndex : null,
  };
}

/**
 * Public problem examples only (already filtered by repository, still re-check).
 * @param {unknown} examples
 */
function sanitizePublicExamples(examples) {
  if (!Array.isArray(examples)) return [];
  return examples
    .filter((ex) => ex && typeof ex === 'object')
    .map((ex) => {
      const e = /** @type {Record<string, unknown>} */ (ex);
      return {
        input: typeof e.input === 'string' ? e.input : '',
        output: typeof e.output === 'string' ? e.output : '',
        explanation: typeof e.explanation === 'string' ? e.explanation : null,
      };
    });
}

/**
 * Full coach context sanitization before PromptBuilder.
 * @param {object} input
 */
function sanitizeCoachContext(input) {
  const src = input && typeof input === 'object' ? input : {};

  // Sanitize run/submit BEFORE stripping visibility flags used for filtering.
  const lastRunResult = sanitizeLastRunResult(src.lastRunResult);
  const lastSubmission = sanitizeLastSubmission(src.lastSubmission);

  return {
    problemId: typeof src.problemId === 'string' ? src.problemId : null,
    language: typeof src.language === 'string' ? src.language : null,
    code: typeof src.code === 'string' ? src.code : '',
    action: typeof src.action === 'string' ? src.action : 'UNKNOWN',
    message: typeof src.message === 'string' ? src.message : '',
    hintLevel:
      src.hintLevel == null || src.hintLevel === ''
        ? null
        : Number(src.hintLevel),
    lastRunResult,
    lastSubmission,
  };
}

module.exports = {
  deepSanitize,
  sanitizeCoachContext,
  sanitizeLastRunResult,
  sanitizeLastSubmission,
  sanitizePublicExamples,
  sanitizePublicResults,
  FORBIDDEN_KEYS,
};
