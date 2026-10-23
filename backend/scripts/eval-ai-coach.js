/**
 * Opt-in local evaluation of the configured Ollama model.
 *
 * Usage (from backend/): npm run eval:coach
 *
 * Skips with exit 0 when Ollama is down or the configured model is not
 * installed. This script does not download a model and is not part of CI.
 * It prints criterion results, not prompts, source, or full answers.
 */

const { config } = require('../src/config');
const { CoachService } = require('../src/modules/ai/coach.service');
const { createOllamaProvider } = require('../src/modules/ai/providers/ollama.provider');
const { executeCodeRun } = require('../src/modules/code/code.service');
const { evidenceFromRun } = require('../src/modules/ai/coach-verify');
const {
  PALINDROME_PROGRAM,
  BROKEN_PALINDROME_PROGRAM,
  OFF_BY_ONE_PROGRAM,
  TRACE_MESSAGE,
  TRACE_EXPECTATIONS,
  PALINDROME_PROBLEM,
  gradePalindromeReview,
  gradeTrailingZeroBug,
  gradeOffByOne,
  gradeHalfReversalComplexity,
  gradeSelfCorrection,
  gradeVerifiedOutcomes,
} = require('../src/modules/ai/coach-eval');

const USER_ID = '00000000-0000-7000-8000-0000000000e1';

const SUM_PROBLEM = Object.freeze({
  id: '00000000-0000-7000-8000-0000000000bb',
  title: 'Sum 1 to N',
  difficulty: 'easy',
  statement: 'Read an integer n and print the sum of the integers from 1 through n, inclusive.',
  constraints: '1 <= n <= 10000',
});

function problemRow(problem) {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    constraints_text: problem.constraints,
  };
}

function inlineExample(input, output) {
  return {
    is_inline: true,
    input_ref: input,
    expected_output_ref: output,
    explanation: null,
  };
}

async function modelInstalled(baseUrl, model) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return false;
  const body = await response.json();
  const names = Array.isArray(body.models) ? body.models.map((row) => row.name) : [];
  return names.some((name) => name === model || name.startsWith(`${model}:`));
}

function report(id, passed, reason) {
  const status = passed ? 'PASS' : 'FAIL';
  const detail = reason ? ` ${reason}` : '';
  console.log(`${id}: ${status}${detail}`);
  return passed;
}

const TRACE_CASES = TRACE_EXPECTATIONS.map((item) => ({
  label: item.input,
  input: `${item.input}\n`,
  expectedOutput: `${item.output}\n`,
  expected: item.output,
}));

const SUM_CASE = {
  label: '4',
  input: '4\n',
  expectedOutput: '10\n',
  expected: '10',
};

async function runInSandbox(sourceCode, cases) {
  const run = await executeCodeRun(
    {
      problemId: PALINDROME_PROBLEM.id,
      language: 'cpp',
      sourceCode,
      cases: cases.map((item) => ({
        input: item.input,
        expectedOutput: item.expectedOutput,
      })),
    },
    {
      problems: {
        getProblemById: async () => ({
          id: PALINDROME_PROBLEM.id,
          timeLimitMs: 2000,
          memoryLimitMb: 256,
        }),
      },
      testCases: {
        getPublicExamples: async () => {
          throw new Error('verification must not load samples');
        },
      },
    },
  );
  return evidenceFromRun(run, cases);
}

function modelAnswered(answer) {
  return typeof answer === 'string' && !/Ollama request timed out|The model did not answer/i.test(answer);
}

async function ask(service, problem, body) {
  const result = await service.coach(
    { problemId: problem.id, language: 'cpp', ...body },
    USER_ID,
  );
  return result.answer;
}

async function main() {
  const model = config.ai.ollama.model;
  const baseUrl = config.ai.ollama.baseUrl;
  console.log(`model_eval: ${model}`);

  let installed = false;
  try {
    installed = await modelInstalled(baseUrl, model);
  } catch {
    console.log('model_eval: skipped (Ollama unavailable)');
    return;
  }
  if (!installed) {
    console.log('model_eval: skipped (model not installed)');
    return;
  }

  /** @type {Map<string, object>} */
  const evidenceBySource = new Map();
  let sandboxReady = false;
  try {
    const correctEvidence = await runInSandbox(PALINDROME_PROGRAM, TRACE_CASES);
    const brokenEvidence = await runInSandbox(BROKEN_PALINDROME_PROGRAM, TRACE_CASES);
    const sumEvidence = await runInSandbox(OFF_BY_ONE_PROGRAM, [SUM_CASE]);
    const correctOk = correctEvidence.results.every(
      (row, index) => row.printed === TRACE_CASES[index].expected,
    );
    const brokenTen = brokenEvidence.results.find((row) => row.label === '10');
    const sumRow = sumEvidence.results[0];
    if (
      correctEvidence.status !== 'verified' ||
      !correctOk ||
      brokenTen?.printed !== 'true' ||
      sumRow?.printed !== '6'
    ) {
      console.log('execution: sandbox output did not match the fixture contract');
      process.exitCode = 1;
      return;
    }
    evidenceBySource.set(PALINDROME_PROGRAM, correctEvidence);
    evidenceBySource.set(BROKEN_PALINDROME_PROGRAM, brokenEvidence);
    evidenceBySource.set(OFF_BY_ONE_PROGRAM, sumEvidence);
    sandboxReady = true;
    console.log('execution: sandbox');
  } catch {
    console.log('execution: skipped (sandbox unavailable)');
  }

  const service = new CoachService({
    provider: createOllamaProvider({ timeoutMs: 180000 }),
    verifyExecution: async ({ sourceCode }) =>
      evidenceBySource.get(sourceCode) || { status: 'unavailable', results: [] },
    problems: {
      findById: async (id) => {
        if (id === PALINDROME_PROBLEM.id) return problemRow(PALINDROME_PROBLEM);
        if (id === SUM_PROBLEM.id) return problemRow(SUM_PROBLEM);
        return null;
      },
    },
    testCases: {
      getPublicExamples: async (id) => {
        if (id === SUM_PROBLEM.id) return [inlineExample('4', '10')];
        return [inlineExample('121', 'true'), inlineExample('10', 'false')];
      },
    },
  });

  let failed = 0;
  const review = await ask(service, PALINDROME_PROBLEM, {
    action: 'REVIEW',
    code: PALINDROME_PROGRAM,
    message: 'Review this solution for correctness.',
  });
  const reviewGrade = gradePalindromeReview(review);
  if (
    !report(
      'A model text',
      modelAnswered(review) &&
        reviewGrade.doesNotInventOddDigitBug &&
        reviewGrade.doesNotCallTenOdd,
      modelAnswered(review) ? '' : 'model did not answer',
    )
  ) {
    failed += 1;
  }
  if (sandboxReady) {
    const shown = gradeVerifiedOutcomes(review, evidenceBySource.get(PALINDROME_PROGRAM).results);
    if (!report('A verified outputs', shown.every((row) => row.printed && row.expected))) {
      failed += 1;
    }
  } else {
    console.log('A verified outputs: SKIP');
  }

  const traces = await ask(service, PALINDROME_PROBLEM, {
    action: 'UNKNOWN',
    code: PALINDROME_PROGRAM,
    message: TRACE_MESSAGE,
    history: [
      {
        role: 'assistant',
        content: 'This fails on odd-digit numbers. 10 is an odd-digit example.',
      },
    ],
  });
  if (sandboxReady) {
    const shown = gradeVerifiedOutcomes(traces, evidenceBySource.get(PALINDROME_PROGRAM).results);
    const missing = shown.filter((row) => !row.printed || !row.expected).map((row) => row.label);
    if (!report('B verified traces', missing.length === 0, missing.length ? `missing ${missing.join(',')}` : '')) {
      failed += 1;
    }
  } else {
    console.log('B verified traces: SKIP');
  }

  const broken = await ask(service, PALINDROME_PROBLEM, {
    action: 'REVIEW',
    code: BROKEN_PALINDROME_PROGRAM,
    message: 'Review this solution. Check input 10.',
  });
  if (sandboxReady) {
    const shown = gradeVerifiedOutcomes(broken, [
      { label: '10', printed: 'true', expected: 'false' },
    ]);
    if (!report('C verified defect', shown[0].printed && shown[0].expected)) failed += 1;
  } else {
    console.log('C verified defect: SKIP');
  }
  if (
    !report(
      'C model text',
      modelAnswered(broken) && gradeTrailingZeroBug(broken).identifiesTen,
      modelAnswered(broken) ? '' : 'model did not answer',
    )
  ) {
    failed += 1;
  }

  const offByOne = await ask(service, SUM_PROBLEM, {
    action: 'REVIEW',
    code: OFF_BY_ONE_PROGRAM,
    message: 'This should print the sum of integers from 1 through n. Review input 4.',
  });
  if (sandboxReady) {
    const shown = gradeVerifiedOutcomes(offByOne, [{ label: '4', printed: '6', expected: '10' }]);
    if (!report('D verified output', shown[0].printed && shown[0].expected)) failed += 1;
  } else {
    console.log('D verified output: SKIP');
  }
  if (
    !report(
      'D model text',
      modelAnswered(offByOne) && gradeOffByOne(offByOne).identifiesBound,
      modelAnswered(offByOne) ? '' : 'model did not answer',
    )
  ) {
    failed += 1;
  }

  const complexity = await ask(service, PALINDROME_PROBLEM, {
    action: 'COMPLEXITY',
    code: PALINDROME_PROGRAM,
    message: 'State the time and space complexity of this exact code.',
  });
  const complexityGrade = gradeHalfReversalComplexity(complexity);
  if (
    !report(
      'E complexity',
      modelAnswered(complexity) &&
        complexityGrade.timeMatchesAlgorithm &&
        complexityGrade.spaceMatchesAlgorithm,
    )
  ) {
    failed += 1;
  }

  const correction = gradeSelfCorrection(traces);
  if (
    !report(
      'F self-correction',
      modelAnswered(traces) && correction.acknowledged,
      correction.acknowledged ? '' : 'did not acknowledge the earlier claim',
    )
  ) {
    failed += 1;
  }

  if (failed > 0) {
    console.log(`model_eval: ${failed} criterion failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('model_eval: all criteria passed');
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : 'evaluation failed';
  console.error(`model_eval: error (${message})`);
  process.exitCode = 1;
});
