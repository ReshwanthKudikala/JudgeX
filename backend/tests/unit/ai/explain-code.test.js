/**
 * Sprint 42 — Explain My Code unit tests (mocked provider).
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
const { buildCoachPrompt, clearPromptTemplateCache } = require('../../../src/modules/ai/prompt-builder');
const { CoachService } = require('../../../src/modules/ai/coach.service');
const {
  EMPTY_CODE_MESSAGE,
  isCoachCodeEmpty,
  mapCoachMarkdownAnswer,
  mapCoachProviderError,
} = require('../../../src/modules/ai/explain-code');
const { ValidationError } = require('../../../src/shared/errors/http-errors');
const { AIError } = require('../../../src/shared/errors/domain-errors');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

const SAMPLE_MARKDOWN = `# Overview
This solution uses a hash map to find two numbers that sum to the target.

# Step-by-step Explanation
1. Scan each value.
2. Look up the complement in the map.
3. Return the indices when found.

# Time Complexity
O(n) because each element is processed once.

# Space Complexity
O(n) for the hash map in the worst case.

# Strengths
- Clear single-pass approach
- Matches the classic two-sum idea

# Possible Weaknesses
- Assumes unique indices
- Uses extra memory

# Learning Tip
Name variables for the complement so the intent is obvious.`;

describe('Explain My Code — empty code', () => {
  it('detects empty / whitespace-only code', () => {
    assert.equal(isCoachCodeEmpty(''), true);
    assert.equal(isCoachCodeEmpty('   \n\t'), true);
    assert.equal(isCoachCodeEmpty('print(1)'), false);
  });

  it('rejects EXPLAIN_CODE before contacting the provider', async () => {
    let providerCalled = false;
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async () => {
          providerCalled = true;
          return { text: 'should not run', provider: 'mock' };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
          statement: 'Find two numbers.',
        }),
      },
      testCases: { getPublicExamples: async () => [] },
    });

    await assert.rejects(
      () =>
        svc.coach({
          problemId: PROBLEM_ID,
          language: 'python',
          code: '   ',
          action: 'EXPLAIN_CODE',
          message: 'Explain my code',
        }),
      (err) =>
        err instanceof ValidationError &&
        err.message === EMPTY_CODE_MESSAGE &&
        providerCalled === false,
    );
  });
});

describe('Explain My Code — action routing', () => {
  it('routes explain_code aliases to EXPLAIN_CODE', () => {
    assert.equal(resolveCoachAction('EXPLAIN_CODE'), COACH_ACTIONS.EXPLAIN_CODE);
    assert.equal(resolveCoachAction('explain_code'), COACH_ACTIONS.EXPLAIN_CODE);
  });
});

describe('Explain My Code — prompt creation', () => {
  afterEach(() => {
    clearPromptTemplateCache();
  });

  it('builds a code-focused prompt with problem context and without run/submit', () => {
    const built = buildCoachPrompt({
      action: 'EXPLAIN_CODE',
      language: 'python',
      code: 'def twoSum(a, t):\n  return [0, 1]',
      message: 'Explain my current code in the context of this problem.',
      problem: {
        title: 'Two Sum',
        difficulty: 'easy',
        statement: 'Return indices of two numbers that add to target.',
        constraints: '2 <= n <= 1e4',
        examples: [{ input: '2\n1 2 3', output: '0 1', explanation: null }],
      },
      lastRunResult: {
        status: 'wrong_answer',
        results: [{ input: 'SECRET', expectedOutput: 'X', isHidden: true }],
      },
      lastSubmission: { verdict: 'wrong_answer', totalTests: 99 },
    });

    assert.equal(built.action, COACH_ACTIONS.EXPLAIN_CODE);
    assert.equal(built.meta.codeFocused, true);
    assert.match(built.system, /EXPLAIN_CODE/);
    assert.match(built.system, /# Overview/);
    assert.match(built.system, /Learning Tip/);
    assert.match(built.user, /Two Sum/);
    assert.match(built.user, /Return indices/);
    assert.match(built.user, /2 <= n/);
    assert.match(built.user, /Public examples/);
    assert.match(built.user, /def twoSum/);
    assert.match(built.user, /Selected action\nEXPLAIN_CODE/);
    assert.doesNotMatch(built.user, /Latest Run result/);
    assert.doesNotMatch(built.user, /Latest Submit/);
    assert.doesNotMatch(built.user, /SECRET/);
    assert.doesNotMatch(built.user, /totalTests/);
    assert.doesNotMatch(built.user, /## Editorial|editorial content/i);
  });
});

describe('Explain My Code — markdown response mapping', () => {
  it('unwraps outer markdown fences and preserves sections', () => {
    const mapped = mapCoachMarkdownAnswer(`\`\`\`markdown\n${SAMPLE_MARKDOWN}\n\`\`\``, {
      action: COACH_ACTIONS.EXPLAIN_CODE,
    });
    assert.equal(mapped.format, 'markdown');
    assert.match(mapped.answer, /^# Overview/m);
    assert.ok(mapped.sectionsFound.includes('Overview'));
    assert.ok(mapped.sectionsFound.includes('Learning Tip'));
    assert.doesNotMatch(mapped.answer, /^```/);
  });

  it('wraps plain text under Overview for EXPLAIN_CODE', () => {
    const mapped = mapCoachMarkdownAnswer('This uses a hash map.', {
      action: COACH_ACTIONS.EXPLAIN_CODE,
    });
    assert.match(mapped.answer, /^# Overview/);
    assert.match(mapped.answer, /hash map/);
  });
});

describe('Explain My Code — mocked Ollama', () => {
  beforeEach(() => {
    resetCoachProvider();
  });

  afterEach(() => {
    resetCoachProvider();
  });

  it('returns mapped markdown from a mocked provider', async () => {
    let seenSystem = '';
    let seenUser = '';
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async ({ system, user }) => {
          seenSystem = system;
          seenUser = user;
          return {
            text: SAMPLE_MARKDOWN,
            provider: 'ollama',
            model: 'llama3',
            tokensUsed: 120,
          };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
          difficulty: 'easy',
          statement: 'Find two numbers that add to target.',
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
      code: 'def twoSum(nums, target):\n  seen = {}\n  for i, x in enumerate(nums):\n    if target - x in seen: return [seen[target - x], i]\n    seen[x] = i',
      action: 'EXPLAIN_CODE',
      message: 'Explain my current code in the context of this problem.',
      lastRunResult: {
        results: [{ input: 'hidden-should-not-appear', isHidden: true }],
      },
    });

    assert.equal(result.provider, 'ollama');
    assert.equal(result.model, 'llama3');
    assert.equal(result.tokensUsed, 120);
    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /# Overview/);
    assert.match(result.answer, /# Learning Tip/);
    assert.match(seenSystem, /Do NOT rewrite/);
    assert.match(seenUser, /twoSum/);
    assert.doesNotMatch(seenUser, /hidden-should-not-appear/);
  });

  it('maps provider timeout to a friendly AIError', () => {
    const mapped = mapCoachProviderError(new AIError('Ollama request timed out.'));
    assert.equal(mapped.code, 'AI_TIMEOUT');
    assert.match(mapped.message, /timed out/i);
  });

  it('maps unavailable provider to a friendly AIError', () => {
    const mapped = mapCoachProviderError(new AIError('Ollama is unavailable.'));
    assert.equal(mapped.code, 'AI_UNAVAILABLE');
    assert.match(mapped.message, /local AI model is unavailable/i);
  });
});
