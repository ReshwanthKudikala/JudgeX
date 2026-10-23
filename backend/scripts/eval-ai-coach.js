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
const {
  PALINDROME_CPP,
  BROKEN_PALINDROME_CPP,
  OFF_BY_ONE_CPP,
  TRACE_MESSAGE,
  PALINDROME_PROBLEM,
  gradePalindromeReview,
  gradeTraces,
  gradeTrailingZeroBug,
  gradeOffByOne,
  gradeHalfReversalComplexity,
  gradeSelfCorrection,
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

  const service = new CoachService({
    provider: createOllamaProvider({ timeoutMs: 120000 }),
    problems: {
      findById: async (id) => {
        if (id === PALINDROME_PROBLEM.id) return problemRow(PALINDROME_PROBLEM);
        if (id === SUM_PROBLEM.id) return problemRow(SUM_PROBLEM);
        return null;
      },
    },
    testCases: {
      getPublicExamples: async (id) => {
        if (id === SUM_PROBLEM.id) return [inlineExample('3', '6')];
        return [inlineExample('121', 'true'), inlineExample('10', 'false')];
      },
    },
  });

  let failed = 0;
  const review = await ask(service, PALINDROME_PROBLEM, {
    action: 'REVIEW',
    code: PALINDROME_CPP,
    message: 'Review this solution for correctness.',
  });
  const reviewGrade = gradePalindromeReview(review);
  if (
    !report(
      'A palindrome review',
      reviewGrade.doesNotInventOddDigitBug && reviewGrade.doesNotCallTenOdd,
      reviewGrade.doesNotInventOddDigitBug ? '' : 'reported an odd-digit defect',
    )
  ) {
    failed += 1;
  }

  const traces = await ask(service, PALINDROME_PROBLEM, {
    action: 'UNKNOWN',
    code: PALINDROME_CPP,
    message: TRACE_MESSAGE,
    history: [
      {
        role: 'assistant',
        content: 'This fails on odd-digit numbers. 10 is an odd-digit example.',
      },
    ],
  });
  const traceGrade = gradeTraces(traces);
  const missing = traceGrade.filter((item) => !item.mentioned).map((item) => item.input);
  const wrong = traceGrade
    .filter((item) => item.mentioned && !item.outputNear)
    .map((item) => item.input);
  if (
    !report(
      'B required traces',
      missing.length === 0 && wrong.length === 0,
      [
        missing.length ? `missing ${missing.join(',')}` : '',
        wrong.length ? `output unclear for ${wrong.join(',')}` : '',
      ]
        .filter(Boolean)
        .join('; '),
    )
  ) {
    failed += 1;
  }

  const broken = await ask(service, PALINDROME_PROBLEM, {
    action: 'REVIEW',
    code: BROKEN_PALINDROME_CPP,
    message: 'Review this solution. Check input 10.',
  });
  if (!report('C known incorrect solution', gradeTrailingZeroBug(broken).identifiesTen)) {
    failed += 1;
  }

  const offByOne = await ask(service, SUM_PROBLEM, {
    action: 'REVIEW',
    code: OFF_BY_ONE_CPP,
    message: 'This should print the sum of integers from 1 through n. Review the loop.',
  });
  if (!report('D debugging', gradeOffByOne(offByOne).identifiesBound)) failed += 1;

  const complexity = await ask(service, PALINDROME_PROBLEM, {
    action: 'COMPLEXITY',
    code: PALINDROME_CPP,
    message: 'State the time and space complexity of this exact code.',
  });
  const complexityGrade = gradeHalfReversalComplexity(complexity);
  if (
    !report(
      'E complexity',
      complexityGrade.timeMatchesAlgorithm && complexityGrade.spaceMatchesAlgorithm,
    )
  ) {
    failed += 1;
  }

  const correction = gradeSelfCorrection(traces);
  const correctionMissing = correction.traces
    .filter((item) => !item.mentioned)
    .map((item) => item.input);
  if (
    !report(
      'F self-correction',
      correction.acknowledged && correctionMissing.length === 0,
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
