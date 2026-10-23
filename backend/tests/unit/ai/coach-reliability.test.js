/**
 * Deterministic coach reliability checks.
 * These tests do not call Ollama.
 */

const fs = require('fs');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const { coachRequestSchema } = require('../../../src/modules/ai/coach.validators');
const { buildCoachPrompt, clearPromptTemplateCache } = require('../../../src/modules/ai/prompt-builder');
const { sanitizeCoachContext } = require('../../../src/modules/ai/context-sanitizer');
const { CoachService } = require('../../../src/modules/ai/coach.service');
const { createOllamaProvider } = require('../../../src/modules/ai/providers/ollama.provider');
const { mapCoachProviderError } = require('../../../src/modules/ai/explain-code');
const { AIError } = require('../../../src/shared/errors/domain-errors');
const {
  extractRequestedInputs,
  missingRequestedInputs,
  challengesPriorClaim,
} = require('../../../src/modules/ai/coach-instruction');
const { selectVerificationCases } = require('../../../src/modules/ai/coach-verify');
const { numPredictForAction } = require('../../../src/modules/ai/generation-budget');
const {
  PALINDROME_CPP,
  BROKEN_PALINDROME_CPP,
  OFF_BY_ONE_CPP,
  TRACE_MESSAGE,
  PALINDROME_PROBLEM,
  gradeVerifiedOutcomes,
  gradePalindromeReview,
  gradeTraces,
  gradeTrailingZeroBug,
  gradeOffByOne,
  gradeHalfReversalComplexity,
  gradeSelfCorrection,
} = require('../../../src/modules/ai/coach-eval');

const PROBLEM_ID = PALINDROME_PROBLEM.id;

before(() => {
  clearPromptTemplateCache();
});

describe('Requested input extraction', () => {
  it('keeps the six palindrome inputs and does not treat 10 as part of 12321', () => {
    const inputs = extractRequestedInputs(TRACE_MESSAGE);
    assert.deepEqual(inputs, ['10', '121', '12321', '1221', '0', '123']);
    const missing = missingRequestedInputs(
      TRACE_MESSAGE,
      '1221 stays a palindrome. 10 ends in zero.',
    );
    assert.deepEqual(missing, ['121', '12321', '0', '123']);
    assert.equal(challengesPriorClaim(TRACE_MESSAGE), true);
    assert.deepEqual(
      missingRequestedInputs('Check input 10.', 'Time is O(log10(n)).'),
      ['10'],
    );
  });
});

describe('Review prompt construction', () => {
  it('sends the exact source, a verification rule, and every requested input', () => {
    const built = buildCoachPrompt({
      action: 'REVIEW',
      language: 'cpp',
      code: PALINDROME_CPP,
      message: 'Review this solution.',
      problem: PALINDROME_PROBLEM,
    });
    assert.match(built.system, /Task: REVIEW/);
    assert.match(built.system, /Overall Review/);
    assert.match(built.system, /Final Rating/);
    assert.match(built.system, /technical interviewer/i);
    assert.match(built.system, /Do NOT rewrite/i);
    assert.match(built.system, /trace the submitted source/i);
    assert.match(built.user, /x != 0 && x % 10 == 0/);
    assert.match(built.user, /reversedHalf \/ 10/);
    assert.doesNotMatch(built.user, /SECRET|HIDDEN/);
  });

  it('numbers a follow-up trace list and asks the model to retract a prior claim', () => {
    const built = buildCoachPrompt({
      action: 'UNKNOWN',
      language: 'cpp',
      code: PALINDROME_CPP,
      message: TRACE_MESSAGE,
      history: [
        {
          role: 'assistant',
          content: 'This fails on odd-digit numbers. 10 is an odd-digit example.',
        },
      ],
      problem: PALINDROME_PROBLEM,
    });
    assert.match(built.user, /Current source code is the code to judge|Current source code section/);
    assert.match(built.user, /The earlier claim was wrong/);
    assert.match(built.user, /quote the source line/i);
    assert.match(built.user, /fails on odd-digit numbers/);
    for (const item of ['10', '121', '12321', '1221', '0', '123']) {
      assert.match(built.user, new RegExp(`Required checks[\\s\\S]*\`${item}\``));
    }
    const single = buildCoachPrompt({
      action: 'REVIEW',
      language: 'cpp',
      code: BROKEN_PALINDROME_CPP,
      message: 'Review this solution. Check input 10.',
      problem: PALINDROME_PROBLEM,
    });
    assert.match(single.user, /Required checks[\s\S]*`10`/);
    assert.doesNotMatch(single.user, /x % 10 == 0/);

    const sourceAt = built.user.indexOf('x != 0 && x % 10 == 0');
    const checksAt = built.user.indexOf('Required checks');
    assert.ok(sourceAt > 0 && checksAt > sourceAt);
  });
});

describe('Review graders', () => {
  it('rejects the observed odd-digit claim and accepts a traced review', () => {
    const bad = gradePalindromeReview(
      'This solution fails on odd-digit numbers. 10 is an odd-digit example and is not handled.',
    );
    assert.equal(bad.doesNotInventOddDigitBug, false);
    assert.equal(bad.doesNotCallTenOdd, false);

    const good = gradePalindromeReview(
      [
        '10 is even. The trailing-zero check prints false.',
        'Odd lengths use reversedHalf / 10. This is not a bug.',
      ].join('\n'),
    );
    assert.equal(good.doesNotInventOddDigitBug, true);
    assert.equal(good.doesNotCallTenOdd, true);
  });

  it('scores traces, a real trailing-zero bug, an off-by-one, and complexity separately', () => {
    const traces = gradeTraces(
      [
        '10 -> false',
        '121 -> true',
        '12321 -> true',
        '1221 -> true',
        '0 -> true',
        '123 -> false',
      ].join('\n'),
    );
    assert.equal(traces.every((item) => item.mentioned && item.outputNear), true);
    assert.equal(
      gradeTrailingZeroBug('Input 10 is not a palindrome, but this code prints true.').identifiesTen,
      true,
    );
    assert.equal(
      gradeTrailingZeroBug('The solution correctly identifies 10 as not a palindrome.').identifiesTen,
      false,
    );
    assert.equal(gradeOffByOne('The loop is off-by-one: i < n excludes n.').identifiesBound, true);
    const complexity = gradeHalfReversalComplexity('Time is O(log n). Space is O(1).');
    assert.equal(complexity.timeMatchesAlgorithm, true);
    assert.equal(complexity.spaceMatchesAlgorithm, true);
    assert.equal(
      gradeHalfReversalComplexity('Time is O(n^2). Space is O(n).').timeMatchesAlgorithm,
      false,
    );
    assert.equal(
      gradeSelfCorrection(
        'That earlier claim was wrong. 10 -> false. 121 -> true. 12321 -> true. 1221 -> true. 0 -> true. 123 -> false.',
      ).acknowledged,
      true,
    );
  });
});

describe('Incomplete and failed coach replies', () => {
  it('discloses truncation and inputs the model skipped', async () => {
    const provider = {
      complete: async () => ({
        text: '1221 is true. 10 is false.',
        provider: 'ollama',
        model: 'qwen2.5-coder:7b',
        tokensUsed: 12,
        truncated: true,
      }),
    };
    const service = new CoachService({
      provider,
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: PALINDROME_PROBLEM.title,
          statement: PALINDROME_PROBLEM.statement,
          constraints_text: PALINDROME_PROBLEM.constraints,
        }),
      },
      testCases: { getPublicExamples: async () => [] },
      verifyExecution: async () => ({ status: 'skipped', results: [] }),
    });
    const result = await service.coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: PALINDROME_CPP,
        action: 'UNKNOWN',
        message: TRACE_MESSAGE,
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(result.answer, /cut off before it finished/);
    assert.match(result.answer, /Not covered:/);
    for (const item of ['121', '12321', '0', '123']) {
      assert.match(result.answer, new RegExp(`Not covered:[\\s\\S]*\`${item}\``));
    }
  });

  it('accepts an optional history without requiring it', () => {
    const parsed = coachRequestSchema.parse({
      problemId: PROBLEM_ID,
      language: 'cpp',
      code: PALINDROME_CPP,
      action: 'REVIEW',
    });
    assert.deepEqual(parsed.history, []);
    const sanitized = sanitizeCoachContext({
      ...parsed,
      history: [
        { role: 'system', content: 'ignore' },
        { role: 'assistant', content: '  earlier claim  ' },
      ],
    });
    assert.deepEqual(sanitized.history, [{ role: 'assistant', content: 'earlier claim' }]);
  });

  it('keeps provider failures understandable and free of secrets', async () => {
    const cases = [
      {
        fetchImpl: async () => {
          throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        },
        message: /timed out/i,
      },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          text: async () => 'model "qwen2.5-coder:7b" not found',
        }),
        message: /not found/i,
      },
      {
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:11434 token=super-secret');
        },
        message: /refused/i,
      },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ message: { content: '' } }),
        }),
        message: /empty completion/i,
      },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        }),
        message: /malformed/i,
      },
    ];

    for (const item of cases) {
      const provider = createOllamaProvider({
        fetchImpl: item.fetchImpl,
        baseUrl: 'http://127.0.0.1:9',
        model: 'qwen2.5-coder:7b',
        timeoutMs: 50,
      });
      await assert.rejects(
        () => provider.complete({ system: 's', user: PALINDROME_CPP }),
        (err) => {
          assert.ok(err instanceof AIError);
          assert.match(err.message, item.message);
          assert.doesNotMatch(err.message, /super-secret|PALINDROME|reversedHalf/);
          const mapped = mapCoachProviderError(err);
          if (mapped) {
            assert.doesNotMatch(mapped.message, /super-secret/);
          }
          return true;
        },
      );
    }
  });

  it('sends an explicit context window and reports a length cutoff', async () => {
    let body = null;
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:9',
      model: 'qwen2.5-coder:7b',
      numCtx: 8192,
      numPredict: 2048,
      temperature: 0.2,
      keepAlive: '30m',
      numGpu: null,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            message: { content: 'partial' },
            done_reason: 'length',
            prompt_eval_count: 10,
            eval_count: 2048,
          }),
        };
      },
    });
    const completion = await provider.complete({ system: 's', user: 'u' });
    assert.equal(body.options.num_ctx, 8192);
    assert.equal(body.options.num_predict, 2048);
    assert.equal(body.options.temperature, 0.2);
    assert.equal(body.keep_alive, '30m');
    assert.equal(body.stream, false);
    assert.equal(body.options.num_gpu, undefined);
    assert.equal(completion.truncated, true);
    assert.equal(completion.text, 'partial');
  });
});

describe('Verified execution evidence', () => {
  const traced = [
    { label: '10', printed: 'false', expected: 'false' },
    { label: '121', printed: 'true', expected: 'true' },
    { label: '12321', printed: 'true', expected: 'true' },
    { label: '1221', printed: 'true', expected: 'true' },
    { label: '0', printed: 'true', expected: 'true' },
    { label: '123', printed: 'false', expected: 'false' },
  ];

  function serviceWith(evidence) {
    return new CoachService({
      provider: {
        complete: async () => ({
          text: 'This solution correctly identifies 10 as not a palindrome. 121 is not a palindrome.',
          provider: 'mock',
          model: 'mock',
          tokensUsed: 1,
        }),
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: PALINDROME_PROBLEM.title,
          statement: PALINDROME_PROBLEM.statement,
          constraints_text: PALINDROME_PROBLEM.constraints,
        }),
      },
      testCases: {
        getPublicExamples: async () => [
          { is_inline: true, input_ref: '121', expected_output_ref: 'true' },
          { is_inline: true, input_ref: '10', expected_output_ref: 'false' },
        ],
      },
      verifyExecution: async () => {
        if (evidence instanceof Error) throw evidence;
        return evidence;
      },
    });
  }

  it('keeps sandbox results when the model text is wrong', async () => {
    const evidence = { status: 'verified', results: traced };
    const result = await serviceWith(evidence).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: PALINDROME_CPP,
        action: 'REVIEW',
        message: TRACE_MESSAGE,
      },
      '00000000-0000-7000-8000-000000000001',
    );
    const outcomes = gradeVerifiedOutcomes(result.answer, traced);
    assert.equal(outcomes.every((row) => row.printed && row.expected), true);
    assert.match(result.answer, /correctly identifies 10/);
    assert.equal(result.verification, 'verified');
  });

  it('shows the broken program printing true for 10', async () => {
    const broken = traced.map((row) =>
      row.label === '10' ? { ...row, printed: 'true', expected: 'false' } : row,
    );
    const result = await serviceWith({ status: 'verified', results: broken }).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: BROKEN_PALINDROME_CPP,
        action: 'REVIEW',
        message: 'Review this solution. Check input 10.',
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(result.answer, /Verified: `10` printed `true`; expected `false`/);
  });

  it('reports an off-by-one output without calling it a style note', async () => {
    const result = await serviceWith({
      status: 'verified',
      results: [{ label: '4', printed: '6', expected: '10' }],
    }).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: OFF_BY_ONE_CPP,
        action: 'REVIEW',
        message: 'Review the loop for input 4.',
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(result.answer, /Verified: `4` printed `6`; expected `10`/);
  });

  it('stays usable when the sandbox is down, times out, or the source does not compile', async () => {
    const down = await serviceWith(new Error('queue timeout')).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: PALINDROME_CPP,
        action: 'REVIEW',
        message: 'Review this solution.',
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(down.answer, /Verified execution: unavailable/);
    assert.doesNotMatch(down.answer, /queue timeout/);

    const compile = await serviceWith({ status: 'compile_error', results: [] }).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: PALINDROME_CPP,
        action: 'REVIEW',
        message: 'Review this solution.',
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(compile.answer, /did not compile/);
    assert.equal(compile.verification, 'compile_error');
  });

  it('keeps sandbox results when the model times out', async () => {
    const result = await new CoachService({
      provider: {
        complete: async () => {
          throw new Error('Ollama request timed out.');
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: PALINDROME_PROBLEM.title,
          statement: PALINDROME_PROBLEM.statement,
          constraints_text: PALINDROME_PROBLEM.constraints,
        }),
      },
      testCases: {
        getPublicExamples: async () => [
          { is_inline: true, input_ref: '10', expected_output_ref: 'false' },
        ],
      },
      verifyExecution: async () => ({
        status: 'verified',
        results: [{ label: '10', printed: 'true', expected: 'false', timedOut: false, exitCode: 0 }],
      }),
    }).coach(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: BROKEN_PALINDROME_CPP,
        action: 'REVIEW',
        message: 'Review this solution.',
      },
      '00000000-0000-7000-8000-000000000001',
    );
    assert.match(result.answer, /timed out/i);
    assert.match(result.answer, /Verified: `10` printed `true`; expected `false`/);
    assert.doesNotMatch(result.answer, /super-secret/);
  });
});

describe('Coach history wiring', () => {
  it('sends the current editor buffer plus the previous turns', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../frontend/src/features/ai-assistant/hooks/useLearningAssistant.ts',
      ),
      'utf8',
    );
    assert.match(source, /const code = getSourceCode\(\)/);
    assert.match(source, /prior\.slice\(-4\)/);
    assert.match(source, /history,/);
    assert.match(source, /askCoachStream/);
  });
});

describe('Generation budget and streaming', () => {
  it('caps review output below the old 2048-token default', () => {
    assert.equal(numPredictForAction('REVIEW', 2048), 480);
    assert.equal(numPredictForAction('EXPLAIN_CODE', 2048), 1024);
    assert.equal(numPredictForAction('HINT', 512), 200);
    assert.equal(numPredictForAction('REVIEW', 128), 128);
  });

  it('keeps at most eight verification inputs', () => {
    const examples = Array.from({ length: 6 }, (_, index) => ({
      input: String(index),
      output: 'true',
    }));
    const cases = selectVerificationCases({
      examples,
      message: 'Check input 10, 121, 12321, and 1221.',
    });
    assert.equal(cases.length, 8);
    assert.deepEqual(
      cases.map((item) => item.label),
      ['0', '1', '2', '3', '4', '5', '10', '121'],
    );
  });

  it('passes the action cap and keep-alive on a streamed chat', async () => {
    let body = null;
    const encoder = new TextEncoder();
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:9',
      model: 'qwen2.5-coder:7b',
      keepAlive: '30m',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ message: { content: 'Hello' }, done: false })}\n`),
            );
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  message: { content: ' there' },
                  done: true,
                  done_reason: 'stop',
                  prompt_eval_count: 12,
                  eval_count: 3,
                  prompt_eval_duration: 2_000_000,
                  eval_duration: 9_000_000,
                  load_duration: 0,
                })}\n`,
              ),
            );
            controller.close();
          },
        });
        return { ok: true, body: stream };
      },
    });
    const events = [];
    for await (const event of provider.completeStream({
      system: 's',
      user: 'u',
      numPredict: 480,
    })) {
      events.push(event);
    }
    assert.equal(body.stream, true);
    assert.equal(body.keep_alive, '30m');
    assert.equal(body.options.num_predict, 480);
    assert.equal(events[0].text, 'Hello');
    assert.equal(events[1].text, ' there');
    const end = events.at(-1);
    assert.equal(end.type, 'end');
    assert.equal(end.text, 'Hello there');
    assert.equal(end.outputTokens, 3);
    assert.equal(end.promptEvalMs, 2);
  });

  it('marks a cancelled stream incomplete and keeps sandbox evidence', async () => {
    const events = [];
    const service = new CoachService({
      provider: {
        id: 'ollama',
        model: 'qwen2.5-coder:7b',
        async *completeStream() {
          yield { type: 'token', text: 'The code prints true.' };
          throw new AIError('The coach request was cancelled.');
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: PALINDROME_PROBLEM.title,
          statement: PALINDROME_PROBLEM.statement,
          constraints_text: PALINDROME_PROBLEM.constraints,
        }),
      },
      testCases: {
        getPublicExamples: async () => [
          { is_inline: true, input_ref: '10', expected_output_ref: 'false' },
        ],
      },
      verifyExecution: async () => ({
        status: 'verified',
        results: [{ label: '10', printed: 'false', expected: 'false' }],
      }),
    });
    await service.coachStream(
      {
        problemId: PROBLEM_ID,
        language: 'cpp',
        code: PALINDROME_CPP,
        action: 'REVIEW',
        message: 'Review this.',
      },
      'user-1',
      {
        write(event, data) {
          events.push({ event, data });
        },
      },
    );
    assert.equal(events[0].event, 'token');
    assert.equal(events.at(-1).event, 'done');
    assert.equal(events.at(-1).data.incomplete, true);
    assert.match(events.at(-1).data.answer, /cancelled/i);
    assert.match(events.at(-1).data.answer, /Verified: `10` printed `false`/);
  });

  it('sends a GPU layer count only when one is configured', async () => {
    let body = null;
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:9',
      model: 'qwen2.5-coder:7b',
      numGpu: 24,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            message: { content: 'ok' },
            done_reason: 'stop',
            eval_count: 1,
            prompt_eval_count: 1,
          }),
        };
      },
    });
    await provider.complete({ system: 's', user: 'u' });
    assert.equal(body.options.num_gpu, 24);
    assert.equal(body.options.num_ctx, 8192);
  });

  it('reports a caller abort before any token as cancelled', async () => {
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:9',
      model: 'qwen2.5-coder:7b',
      fetchImpl: async () => {
        throw new Error('fetch should not run');
      },
    });
    const signal = AbortSignal.abort();
    await assert.rejects(
      () => provider.complete({ system: 's', user: 'u', signal }),
      (err) => {
        assert.match(err.message, /cancelled/i);
        return true;
      },
    );
  });
});

describe('Fixture defects are real', () => {
  it('keeps the known-bad sources distinct from the correct half-reversal', () => {
    assert.match(PALINDROME_CPP, /x != 0 && x % 10 == 0/);
    assert.doesNotMatch(BROKEN_PALINDROME_CPP, /x % 10 == 0/);
    assert.match(OFF_BY_ONE_CPP, /i < n/);
    assert.doesNotMatch(OFF_BY_ONE_CPP, /i <= n/);
  });
});
