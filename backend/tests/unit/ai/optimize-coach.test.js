/**
 * Sprint 46 — Optimization Coach unit tests (mocked provider).
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
  EMPTY_OPTIMIZE_CODE_MESSAGE,
  OPTIMIZE_SECTIONS,
  buildOptimizePerfContext,
  mapOptimizeMarkdownAnswer,
} = require('../../../src/modules/ai/optimize-coach');
const { mapCoachMarkdownAnswer } = require('../../../src/modules/ai/explain-code');
const { requiresSourceCode } = require('../../../src/modules/ai/review-solution');
const { ValidationError } = require('../../../src/shared/errors/http-errors');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

const SAMPLE_OPTIMIZE = `# Current Solution
A nested-loop scan that checks every pair.

# Complexity Analysis
- Time Complexity: O(n²) from the double loop
- Space Complexity: O(1) extra memory

# Can It Be Improved?
Yes — a linear-time hash map approach is typical for this constraint set.

# Alternative Approaches
Hash map complement lookup: O(n) time, O(n) space. Sorting + two pointers: O(n log n) time.

# Scalability
O(n²) will struggle as n approaches the upper constraint.

# Interview Perspective
Interviewers usually accept the brute force as a start, then ask for the O(n) improvement.

# Optimization Tips
1. Store seen values in a map while iterating once.
2. Return indices as soon as the complement is found.
3. Avoid rebuilding structures each iteration.`;

const SAMPLE_OPTIMAL = `# Current Solution
Single-pass hash map storing complements.

# Complexity Analysis
- Time Complexity: O(n)
- Space Complexity: O(n)

# Can It Be Improved?
No meaningful asymptotic improvements for typical Two Sum constraints — this is already optimal in time.

# Alternative Approaches
Sorting + two pointers trades an extra log factor for less hash overhead; rarely better here.

# Scalability
Handles the stated upper bound comfortably.

# Interview Perspective
Interviewers typically accept this and may ask you to discuss the space trade-off.

# Optimization Tips
1. Keep variable names clear for the complement.
2. Mention the O(n) space trade-off out loud.
3. Add a quick correctness check on a public sample.`;

describe('Optimize — action routing & prompt selection', () => {
  it('routes optimize aliases to OPTIMIZE', () => {
    assert.equal(resolveCoachAction('OPTIMIZE'), COACH_ACTIONS.OPTIMIZE);
    assert.equal(resolveCoachAction('optimize'), COACH_ACTIONS.OPTIMIZE);
    assert.equal(resolveCoachAction('suggest_optimizations'), COACH_ACTIONS.OPTIMIZE);
  });

  it('selects optimize.prompt.md and requires source code', () => {
    assert.equal(ACTION_PROMPT_FILES[COACH_ACTIONS.OPTIMIZE], 'optimize.prompt.md');
    assert.equal(requiresSourceCode(COACH_ACTIONS.OPTIMIZE), true);
  });
});

describe('Optimize — empty code', () => {
  it('rejects empty code before contacting the provider', async () => {
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
          code: '  \n',
          action: 'OPTIMIZE',
          message: 'optimize',
        }),
      (err) =>
        err instanceof ValidationError &&
        err.message === EMPTY_OPTIMIZE_CODE_MESSAGE &&
        called === false,
    );
  });
});

describe('Optimize — prompt creation', () => {
  afterEach(() => clearPromptTemplateCache());

  it('builds OPTIMIZE prompt with problem, code, optional perf, no hidden tests', () => {
    const sanitized = sanitizeCoachContext({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'def twoSum(a,t):\n  for i in a:\n    for j in a: ...',
      action: 'OPTIMIZE',
      lastRunResult: {
        status: 'accepted',
        results: [{ input: 'SECRET', isHidden: true, passed: true }],
      },
      lastSubmission: {
        verdict: 'accepted',
        runtimeMs: 12,
        memoryKb: 8192,
        hiddenExpected: 'leak',
      },
    });

    assert.equal(sanitized.lastRunResult.results.length, 0);
    assert.equal(sanitized.lastSubmission.hiddenExpected, undefined);

    const built = buildCoachPrompt({
      action: 'OPTIMIZE',
      language: 'python',
      code: sanitized.code,
      message: 'Optimize my solution',
      problem: {
        title: 'Two Sum',
        statement: 'Find two numbers.',
        constraints: '2 <= n <= 1e4',
        examples: [{ input: '1 2', output: '0 1', explanation: null }],
      },
      lastRunResult: sanitized.lastRunResult,
      lastSubmission: sanitized.lastSubmission,
    });

    assert.equal(built.action, COACH_ACTIONS.OPTIMIZE);
    assert.match(built.system, /Task: OPTIMIZE/);
    assert.match(built.system, /Current Solution/);
    assert.match(built.system, /Can It Be Improved/);
    assert.match(built.system, /invent improvements/i);
    assert.match(built.system, /Do NOT claim improvements/i);
    assert.match(built.user, /Two Sum/);
    assert.match(built.user, /twoSum/);
    assert.match(built.user, /Observed performance/);
    assert.match(built.user, /runtimeMs/);
    assert.doesNotMatch(built.user, /SECRET|leak/);
    assert.ok(OPTIMIZE_SECTIONS.includes('Optimization Tips'));
    assert.deepEqual(
      buildOptimizePerfContext({
        lastSubmission: sanitized.lastSubmission,
      }).runtimeMs,
      12,
    );
  });
});

describe('Optimize — markdown mapping', () => {
  it('preserves sections and unwraps fences', () => {
    const mapped = mapOptimizeMarkdownAnswer(`\`\`\`md\n${SAMPLE_OPTIMIZE}\n\`\`\``, {
      action: COACH_ACTIONS.OPTIMIZE,
    });
    assert.equal(mapped.format, 'markdown');
    assert.match(mapped.answer, /# Current Solution/);
    assert.ok(mapped.sectionsFound.includes('Can It Be Improved?'));
  });

  it('routes through mapCoachMarkdownAnswer', () => {
    const mapped = mapCoachMarkdownAnswer('Nested loops dominate.', {
      action: COACH_ACTIONS.OPTIMIZE,
    });
    assert.match(mapped.answer, /^# Current Solution/);
  });
});

describe('Optimize — mocked provider', () => {
  beforeEach(() => resetCoachProvider());
  afterEach(() => resetCoachProvider());

  it('returns optimization review from mocked Ollama', async () => {
    let seenSystem = '';
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async ({ system }) => {
          seenSystem = system;
          return {
            text: SAMPLE_OPTIMIZE,
            provider: 'ollama',
            model: 'llama3',
            tokensUsed: 110,
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
      testCases: { getPublicExamples: async () => [] },
    });

    const result = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'for i in range(n):\n  for j in range(i+1,n): ...',
      action: 'OPTIMIZE',
      message: 'Optimize my solution',
    });

    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /Complexity Analysis/);
    assert.match(seenSystem, /Do NOT rewrite/i);
  });

  it('handles already-optimal responses without inventing work', async () => {
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async () => ({
          text: SAMPLE_OPTIMAL,
          provider: 'mock',
        }),
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

    const result = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'seen={}\nfor i,x in enumerate(a):\n  if t-x in seen: return ...',
      action: 'OPTIMIZE',
    });

    assert.match(result.answer, /already optimal/i);
    assert.match(result.answer, /Can It Be Improved/);
    assert.doesNotMatch(result.answer, /```python[\s\S]*def /);
  });
});
