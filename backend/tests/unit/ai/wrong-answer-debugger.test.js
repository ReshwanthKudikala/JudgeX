/**
 * Sprint 45 — Wrong Answer Debugger unit tests (mocked provider).
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.AI_PROVIDER = 'ollama';
process.env.AI_TIMEOUT_MS = '5000';
process.env.AI_MAX_CODE_CHARS = '10000';
process.env.AI_MAX_MESSAGE_CHARS = '2000';
process.env.AI_MAX_STATEMENT_CHARS = '4000';

delete require.cache[require.resolve('../../../src/config')];
delete require.cache[require.resolve('../../../src/config/env.schema')];
delete require.cache[require.resolve('../../../src/config/index')];

const { COACH_ACTIONS, resolveCoachAction } = require('../../../src/modules/ai/coach.actions');
const {
  buildCoachPrompt,
  clearPromptTemplateCache,
  ACTION_PROMPT_FILES,
} = require('../../../src/modules/ai/prompt-builder');
const { CoachService } = require('../../../src/modules/ai/coach.service');
const { sanitizeCoachContext } = require('../../../src/modules/ai/context-sanitizer');
const {
  NO_PUBLIC_FAILURE_MESSAGE,
  findPublicFailingCases,
  hasWrongAnswerSignal,
  hasPublicFailingTestcase,
  buildPublicFailureContext,
  mapWrongAnswerMarkdownAnswer,
} = require('../../../src/modules/ai/wrong-answer-debugger');
const { mapCoachMarkdownAnswer } = require('../../../src/modules/ai/explain-code');
const { ValidationError } = require('../../../src/shared/errors/http-errors');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

const SAMPLE_WA = `# Likely Cause
Off-by-one when indexing the second value.

# What the Public Test Case Shows
Expected \`0 1\` but your program printed \`0 2\`.

# Where To Look
Check how you store and return indices after the complement lookup.

# Common Edge Cases
Duplicates, negative numbers, and the first/last index pairs.

# Suggested Debugging Steps
1. Print the complement for the failing input.
2. Confirm the map stores the earlier index.

# Learning Tip
Always verify index pairing against a tiny hand-worked example.`;

describe('Wrong Answer — routing', () => {
  it('routes wrong_answer aliases to WRONG_ANSWER', () => {
    assert.equal(resolveCoachAction('WRONG_ANSWER'), COACH_ACTIONS.WRONG_ANSWER);
    assert.equal(resolveCoachAction('wrong_answer'), COACH_ACTIONS.WRONG_ANSWER);
    assert.equal(resolveCoachAction('why_failed'), COACH_ACTIONS.WRONG_ANSWER);
  });

  it('selects wrong-answer.prompt.md', () => {
    assert.equal(
      ACTION_PROMPT_FILES[COACH_ACTIONS.WRONG_ANSWER],
      'wrong-answer.prompt.md',
    );
  });
});

describe('Wrong Answer — public testcase context', () => {
  afterEach(() => clearPromptTemplateCache());

  it('detects WA signals and public failures', () => {
    assert.equal(
      hasWrongAnswerSignal({
        lastRunResult: { status: 'wrong_answer', results: [] },
      }),
      true,
    );
    assert.equal(
      hasWrongAnswerSignal({
        lastSubmission: { verdict: 'wrong_answer' },
      }),
      true,
    );
    assert.equal(
      hasPublicFailingTestcase({
        lastRunResult: {
          results: [
            {
              input: '1 2',
              expectedOutput: '3',
              actualOutput: '4',
              passed: false,
            },
          ],
        },
      }),
      true,
    );
    assert.equal(
      hasPublicFailingTestcase({
        lastRunResult: { results: [{ passed: true, input: 'ok' }] },
      }),
      false,
    );
  });

  it('builds prompt with public failing cases and no hidden rows', () => {
    const sanitized = sanitizeCoachContext({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'print(1)',
      action: 'WRONG_ANSWER',
      lastRunResult: {
        status: 'wrong_answer',
        results: [
          {
            index: 0,
            input: '1 2',
            expectedOutput: '0 1',
            actualOutput: '0 2',
            passed: false,
            runtimeMs: 3,
          },
          {
            index: 1,
            input: 'SECRET',
            expectedOutput: 'X',
            actualOutput: 'Y',
            isHidden: true,
            passed: false,
          },
        ],
      },
    });

    assert.equal(sanitized.lastRunResult.results.length, 1);
    assert.equal(findPublicFailingCases(sanitized.lastRunResult).length, 1);

    const built = buildCoachPrompt({
      action: 'WRONG_ANSWER',
      language: 'python',
      code: 'def twoSum(...): ...',
      message: 'Debug my Wrong Answer',
      problem: {
        title: 'Two Sum',
        statement: 'Find two numbers.',
        constraints: 'n <= 1e4',
        examples: [{ input: '1 2', output: '0 1', explanation: null }],
      },
      lastRunResult: sanitized.lastRunResult,
      lastSubmission: { verdict: 'wrong_answer', passedTests: 0, totalTests: 12 },
    });

    assert.equal(built.action, COACH_ACTIONS.WRONG_ANSWER);
    assert.match(built.system, /Task: WRONG_ANSWER/);
    assert.match(built.system, /Likely Cause/);
    assert.match(built.user, /Public failing test case/);
    assert.match(built.user, /0 1/);
    assert.match(built.user, /0 2/);
    assert.doesNotMatch(built.user, /SECRET/);
    assert.deepEqual(buildPublicFailureContext(sanitized.lastRunResult)[0].expectedOutput, '0 1');
  });
});

describe('Wrong Answer — missing public failure', () => {
  it('rejects before provider when no public failing case exists', async () => {
    let called = false;
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async () => {
          called = true;
          return { text: 'no', provider: 'mock' };
        },
      },
      problems: {
        findById: async () => ({ id: PROBLEM_ID, title: 'P', statement: 'S' }),
      },
      testCases: { getPublicExamples: async () => [] },
    });

    await assert.rejects(
      () =>
        svc.coach({
          problemId: PROBLEM_ID,
          language: 'python',
          code: 'print(1)',
          action: 'WRONG_ANSWER',
          message: 'debug',
          lastSubmission: { verdict: 'wrong_answer', totalTests: 20 },
          lastRunResult: { status: 'wrong_answer', results: [] },
        }),
      (err) =>
        err instanceof ValidationError &&
        err.message === NO_PUBLIC_FAILURE_MESSAGE &&
        called === false,
    );
  });
});

describe('Wrong Answer — markdown mapping', () => {
  it('maps structured WA markdown', () => {
    const mapped = mapWrongAnswerMarkdownAnswer(SAMPLE_WA, {
      action: COACH_ACTIONS.WRONG_ANSWER,
    });
    assert.equal(mapped.format, 'markdown');
    assert.match(mapped.answer, /# Likely Cause/);
    assert.ok(mapped.sectionsFound.includes('Suggested Debugging Steps'));
  });

  it('routes through mapCoachMarkdownAnswer', () => {
    const mapped = mapCoachMarkdownAnswer('Probably an off-by-one.', {
      action: COACH_ACTIONS.WRONG_ANSWER,
    });
    assert.match(mapped.answer, /^# Likely Cause/);
  });
});

describe('Wrong Answer — mocked provider', () => {
  beforeEach(() => resetCoachProvider());
  afterEach(() => resetCoachProvider());

  it('returns WA analysis for a public failing case', async () => {
    let seenUser = '';
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async ({ user }) => {
          seenUser = user;
          return {
            text: SAMPLE_WA,
            provider: 'ollama',
            model: 'llama3',
            tokensUsed: 90,
          };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
          statement: 'Find two numbers.',
          constraints_text: 'n <= 1e4',
        }),
      },
      testCases: {
        getPublicExamples: async () => [
          {
            input_ref: '2\n1 2 3',
            expected_output_ref: '0 1',
            is_inline: true,
            explanation: null,
          },
        ],
      },
    });

    const result = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'def twoSum(a,t): return [0,2]',
      action: 'WRONG_ANSWER',
      message: 'Debug my Wrong Answer',
      lastRunResult: {
        status: 'wrong_answer',
        results: [
          {
            input: '1 2',
            expectedOutput: '0 1',
            actualOutput: '0 2',
            passed: false,
            runtimeMs: 2,
          },
          {
            input: 'HIDDEN',
            expectedOutput: 'NO',
            actualOutput: 'PEEK',
            isHidden: true,
            passed: false,
          },
        ],
      },
    });

    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /Likely Cause/);
    assert.match(seenUser, /Public failing test case/);
    assert.match(seenUser, /0 1/);
    assert.doesNotMatch(seenUser, /HIDDEN|PEEK/);
  });
});

describe('Frontend WA chip visibility (session rules)', () => {
  function isLatestWrongAnswer(run, submission) {
    const norm = (v) =>
      typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
    if (norm(run?.status) === 'wrong_answer') return true;
    if (norm(submission?.verdict) === 'wrong_answer') return true;
    if (run?.results?.some((r) => r.passed === false)) return true;
    return false;
  }

  it('shows chip only for WA', () => {
    assert.equal(isLatestWrongAnswer({ status: 'accepted' }, null), false);
    assert.equal(
      isLatestWrongAnswer(null, { verdict: 'wrong_answer' }),
      true,
    );
    assert.equal(
      isLatestWrongAnswer(
        { status: 'ok', results: [{ passed: false }] },
        null,
      ),
      true,
    );
  });
});
