/**
 * Sprint 41 — AI Learning Coach foundation unit tests (mocked provider).
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.AI_PROVIDER = 'ollama';
process.env.AI_TIMEOUT_MS = '5000';
process.env.AI_MAX_CODE_CHARS = '1000';
process.env.AI_MAX_MESSAGE_CHARS = '100';
process.env.AI_MAX_STATEMENT_CHARS = '2000';

// Reload config after env overrides for size limits.
delete require.cache[require.resolve('../../../src/config')];
delete require.cache[require.resolve('../../../src/config/env.schema')];
delete require.cache[require.resolve('../../../src/config/index')];

const { COACH_ACTIONS, resolveCoachAction } = require('../../../src/modules/ai/coach.actions');
const {
  sanitizeCoachContext,
  sanitizeLastRunResult,
  sanitizePublicResults,
} = require('../../../src/modules/ai/context-sanitizer');
const { buildCoachPrompt } = require('../../../src/modules/ai/prompt-builder');
const {
  createCoachProvider,
  resetCoachProvider,
} = require('../../../src/modules/ai/providers/provider.factory');
const { CoachService } = require('../../../src/modules/ai/coach.service');
const { ValidationError } = require('../../../src/shared/errors/http-errors');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

describe('Coach actions', () => {
  it('resolves known and legacy actions', () => {
    assert.equal(resolveCoachAction('EXPLAIN_CODE'), COACH_ACTIONS.EXPLAIN_CODE);
    assert.equal(resolveCoachAction('why_failed'), COACH_ACTIONS.WRONG_ANSWER);
    assert.equal(resolveCoachAction('analyze_complexity'), COACH_ACTIONS.COMPLEXITY);
  });

  it('maps unknown actions to UNKNOWN', () => {
    assert.equal(resolveCoachAction('not_a_real_action'), COACH_ACTIONS.UNKNOWN);
    assert.equal(resolveCoachAction(''), COACH_ACTIONS.UNKNOWN);
    assert.equal(resolveCoachAction(null), COACH_ACTIONS.UNKNOWN);
  });
});

describe('Context sanitization', () => {
  it('strips hidden test payloads and metadata', () => {
    const sanitized = sanitizeCoachContext({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'print(1)',
      action: 'WRONG_ANSWER',
      message: 'why?',
      lastRunResult: {
        status: 'wrong_answer',
        results: [
          { index: 0, input: '1 2', expectedOutput: '3', actualOutput: '3', passed: true },
          { index: 1, input: 'SECRET', expectedOutput: 'X', isHidden: true },
        ],
        hiddenTests: [{ input: 'never' }],
        hiddenTestCount: 12,
      },
      lastSubmission: {
        verdict: 'wrong_answer',
        compileOutput: 'ok',
        hiddenExpected: 'leak',
        totalTests: 15,
        passedTests: 2,
      },
    });

    assert.equal(sanitized.lastRunResult.results.length, 1);
    assert.equal(sanitized.lastRunResult.results[0].input, '1 2');
    assert.equal(sanitized.lastRunResult.hiddenTests, undefined);
    assert.equal(sanitized.lastRunResult.hiddenTestCount, undefined);
    assert.equal(sanitized.lastSubmission.hiddenExpected, undefined);
    assert.equal(sanitized.lastSubmission.totalTests, 15);
  });

  it('drops results marked hidden via visibility', () => {
    const results = sanitizePublicResults([
      { input: 'a', expectedOutput: 'b', visibility: 'public' },
      { input: 'c', expectedOutput: 'd', visibility: 'hidden' },
    ]);
    assert.equal(results.length, 1);
    assert.equal(results[0].input, 'a');
  });

  it('sanitizeLastRunResult never includes compile stdout dumps by default', () => {
    const run = sanitizeLastRunResult({
      compile: { success: false, stdout: 'huge', stderr: 'error: x' },
      results: [],
    });
    assert.equal(run.compile.stdout, null);
    assert.equal(run.compile.stderr, 'error: x');
  });
});

describe('PromptBuilder', () => {
  it('includes public problem context and excludes invented hidden sections', () => {
    const built = buildCoachPrompt({
      action: 'EXPLAIN_CODE',
      language: 'python',
      code: 'def solve():\n  return 1',
      message: 'What does this do?',
      problem: {
        title: 'A+B',
        difficulty: 'easy',
        statement: 'Add two numbers.',
        constraints: '1 <= n <= 10',
        examples: [{ input: '1 2', output: '3', explanation: null }],
      },
      lastRunResult: {
        status: 'accepted',
        results: [{ index: 0, input: '1 2', expectedOutput: '3', actualOutput: '3', passed: true }],
      },
    });

    assert.equal(built.action, COACH_ACTIONS.EXPLAIN_CODE);
    assert.match(built.system, /Learning Coach/i);
    assert.match(built.system, /EXPLAIN_CODE|Explain what the learner/i);
    assert.match(built.user, /A\+B/);
    assert.match(built.user, /Public examples/);
    assert.match(built.user, /1 2/);
    assert.doesNotMatch(built.user, /hidden judge tests are included/i);
    assert.match(built.user, /Hidden judge tests are not included/i);
  });

  it('uses UNKNOWN task guidance for unknown actions', () => {
    const built = buildCoachPrompt({
      action: 'something_weird',
      language: 'cpp',
      code: 'int main(){}',
      message: 'help',
    });
    assert.equal(built.action, COACH_ACTIONS.UNKNOWN);
    assert.match(built.system, /UNKNOWN/);
  });
});

describe('Provider selection', () => {
  afterEach(() => {
    resetCoachProvider();
  });

  it('creates ollama provider by default', () => {
    const provider = createCoachProvider({ provider: 'ollama' });
    assert.equal(provider.id, 'ollama');
    assert.equal(typeof provider.complete, 'function');
  });

  it('rejects unknown providers', () => {
    assert.throws(() => createCoachProvider({ provider: 'gemini' }), /Unknown AI_PROVIDER/);
  });
});

describe('CoachService foundation', () => {
  beforeEach(() => {
    resetCoachProvider();
  });

  it('rejects oversized code input', async () => {
    const svc = new CoachService({
      provider: {
        id: 'mock',
        model: 'mock-model',
        complete: async () => ({ text: 'nope', provider: 'mock', model: 'mock-model' }),
      },
      problems: { findById: async () => ({ id: PROBLEM_ID, title: 'X', statement: 'y' }) },
      testCases: { getPublicExamples: async () => [] },
    });

    await assert.rejects(
      () =>
        svc.coach({
          problemId: PROBLEM_ID,
          language: 'python',
          code: 'x'.repeat(1001),
          action: 'EXPLAIN_CODE',
          message: 'hi',
        }),
      (err) => err instanceof ValidationError,
    );
  });

  it('rejects oversized message input', async () => {
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async () => ({ text: 'nope', provider: 'mock' }),
      },
      problems: { findById: async () => ({ id: PROBLEM_ID, title: 'X', statement: 'y' }) },
      testCases: { getPublicExamples: async () => [] },
    });

    await assert.rejects(
      () =>
        svc.coach({
          problemId: PROBLEM_ID,
          language: 'python',
          code: 'print(1)',
          action: 'HINT',
          message: 'm'.repeat(101),
        }),
      (err) => err instanceof ValidationError,
    );
  });

  it('returns provider answer for EXPLAIN_CODE without calling a real model', async () => {
    let seenSystem = '';
    let seenUser = '';
    const svc = new CoachService({
      provider: {
        id: 'mock',
        model: 'mock-model',
        complete: async ({ system, user }) => {
          seenSystem = system;
          seenUser = user;
          return {
            text: 'Your code prints a constant.',
            provider: 'mock',
            model: 'mock-model',
            tokensUsed: 42,
          };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
          difficulty: 'easy',
          statement: 'Find two numbers.',
          constraints_text: 'n <= 1e5',
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

    const result = await svc.coach(
      {
        problemId: PROBLEM_ID,
        language: 'python',
        code: 'print(1)',
        action: 'EXPLAIN_CODE',
        message: 'Explain please',
        lastRunResult: {
          results: [
            { input: 'ok', expectedOutput: '1', isHidden: false },
            { input: 'secret', expectedOutput: 'no', isHidden: true },
          ],
        },
      },
      'user-1',
    );

    assert.equal(result.answer, 'Your code prints a constant.');
    assert.equal(result.provider, 'mock');
    assert.equal(result.model, 'mock-model');
    assert.equal(result.tokensUsed, 42);
    assert.equal(typeof result.durationMs, 'number');
    assert.match(seenSystem, /EXPLAIN_CODE|Explain what the learner/i);
    assert.match(seenUser, /Two Sum/);
    assert.doesNotMatch(seenUser, /secret/);
  });

  it('handles UNKNOWN action via prompt builder', async () => {
    let seenSystem = '';
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async ({ system }) => {
          seenSystem = system;
          return { text: 'generic help', provider: 'mock', tokensUsed: null };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'P',
          statement: 'S',
        }),
      },
      testCases: { getPublicExamples: async () => [] },
    });

    const result = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'cpp',
      code: 'int main(){return 0;}',
      action: 'totally_unknown',
      message: 'hmm',
    });

    assert.equal(result.answer, 'generic help');
    assert.match(seenSystem, /UNKNOWN/);
  });
});
