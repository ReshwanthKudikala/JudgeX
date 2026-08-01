/**
 * Sprint 43 — Review My Solution unit tests (mocked provider).
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
const {
  EMPTY_REVIEW_CODE_MESSAGE,
  REVIEW_SECTIONS,
  requiresSourceCode,
  emptyCodeMessageForAction,
  mapReviewMarkdownAnswer,
  isCoachCodeEmpty,
} = require('../../../src/modules/ai/review-solution');
const { mapCoachMarkdownAnswer } = require('../../../src/modules/ai/explain-code');
const { ValidationError } = require('../../../src/shared/errors/http-errors');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

const SAMPLE_REVIEW = `# Overall Review
Solid single-pass hash map approach with clear intent, suitable for an interview with a few polish points.

# What You Did Well
- Uses an efficient O(n) approach
- Early return when the pair is found

# Areas for Improvement
- Variable names could be more descriptive
- Extract the complement lookup into a named helper for clarity

# Readability
Names like \`seen\` are fine; a short comment on the complement check would help.

# Edge Cases
Consider empty arrays (if allowed), duplicate values, and when no pair exists — based on constraints and public examples only.

# Interview Feedback
Interviewers would like the clear trade-off of extra space for speed. Explain why a hash map beats nested loops.

# Final Rating

| Category | Rating |
|----------|--------|
| Correctness | ⭐⭐⭐⭐☆ |
| Readability | ⭐⭐⭐⭐☆ |
| Efficiency | ⭐⭐⭐⭐⭐ |
| Maintainability | ⭐⭐⭐☆☆ |
| Interview Readiness | ⭐⭐⭐⭐☆ |

# Learning Tip
Narrate the complement idea out loud while coding — it shows communication skill.`;

describe('Review My Solution — action routing', () => {
  it('routes review aliases to REVIEW', () => {
    assert.equal(resolveCoachAction('REVIEW'), COACH_ACTIONS.REVIEW);
    assert.equal(resolveCoachAction('review'), COACH_ACTIONS.REVIEW);
  });

  it('selects review.prompt.md for REVIEW', () => {
    assert.equal(ACTION_PROMPT_FILES[COACH_ACTIONS.REVIEW], 'review.prompt.md');
  });

  it('requires source code for REVIEW', () => {
    assert.equal(requiresSourceCode(COACH_ACTIONS.REVIEW), true);
    assert.equal(requiresSourceCode(COACH_ACTIONS.HINT), false);
  });
});

describe('Review My Solution — empty code', () => {
  it('detects empty code', () => {
    assert.equal(isCoachCodeEmpty(''), true);
    assert.equal(isCoachCodeEmpty('int main(){}'), false);
  });

  it('rejects REVIEW before contacting the provider', async () => {
    let providerCalled = false;
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async () => {
          providerCalled = true;
          return { text: 'nope', provider: 'mock' };
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
          language: 'cpp',
          code: '\n  \t',
          action: 'REVIEW',
          message: 'Review my solution',
        }),
      (err) =>
        err instanceof ValidationError &&
        err.message === EMPTY_REVIEW_CODE_MESSAGE &&
        providerCalled === false,
    );

    assert.equal(emptyCodeMessageForAction(COACH_ACTIONS.REVIEW), EMPTY_REVIEW_CODE_MESSAGE);
  });
});

describe('Review My Solution — prompt creation', () => {
  afterEach(() => {
    clearPromptTemplateCache();
  });

  it('builds REVIEW prompt with problem, code, optional run/submit, and no hidden tests', () => {
    const built = buildCoachPrompt({
      action: 'REVIEW',
      language: 'python',
      code: 'def twoSum(a, t):\n  return [0, 1]',
      message: 'Review my solution like an experienced technical interviewer.',
      problem: {
        title: 'Two Sum',
        difficulty: 'easy',
        statement: 'Return indices of two numbers that add to target.',
        constraints: '2 <= n <= 1e4',
        examples: [{ input: '2\n1 2 3', output: '0 1', explanation: null }],
      },
      lastRunResult: {
        status: 'accepted',
        results: [
          { input: '1 2', expectedOutput: '0 1', passed: true },
        ],
      },
      lastSubmission: { verdict: 'accepted', passedTests: 2, totalTests: 2 },
    });

    assert.equal(built.action, COACH_ACTIONS.REVIEW);
    assert.equal(built.meta.codeFocused, false);
    assert.match(built.system, /Task: REVIEW/);
    assert.match(built.system, /Overall Review/);
    assert.match(built.system, /Final Rating/);
    assert.match(built.system, /technical interviewer/i);
    assert.match(built.system, /Do NOT rewrite/i);
    assert.match(built.user, /Two Sum/);
    assert.match(built.user, /def twoSum/);
    assert.match(built.user, /Latest Run result/);
    assert.match(built.user, /Latest Submit/);
    assert.match(built.user, /Selected action\nREVIEW/);
    assert.doesNotMatch(built.user, /SECRET|HIDDEN/);
  });

  it('includes review restrictions in the system prompt', () => {
    const built = buildCoachPrompt({
      action: 'REVIEW',
      language: 'python',
      code: 'print(1)',
      message: 'review',
    });
    assert.match(built.system, /Do NOT rewrite/i);
    assert.match(built.system, /hidden/i);
  });
});

describe('Review My Solution — markdown mapping', () => {
  it('unwraps fences and finds review sections', () => {
    const mapped = mapReviewMarkdownAnswer(`\`\`\`md\n${SAMPLE_REVIEW}\n\`\`\``, {
      action: COACH_ACTIONS.REVIEW,
    });
    assert.equal(mapped.format, 'markdown');
    assert.match(mapped.answer, /^# Overall Review/m);
    assert.match(mapped.answer, /\| Category \| Rating \|/);
    assert.ok(mapped.sectionsFound.includes('Final Rating'));
    assert.ok(mapped.sectionsFound.includes('Learning Tip'));
    assert.equal(REVIEW_SECTIONS.length, 8);
  });

  it('routes REVIEW through shared mapCoachMarkdownAnswer', () => {
    const mapped = mapCoachMarkdownAnswer('Looks decent overall.', {
      action: COACH_ACTIONS.REVIEW,
    });
    assert.match(mapped.answer, /^# Overall Review/);
  });
});

describe('Review My Solution — mocked provider', () => {
  beforeEach(() => resetCoachProvider());
  afterEach(() => resetCoachProvider());

  it('returns mapped review markdown and sanitizes hidden run cases', async () => {
    let seenUser = '';
    let seenSystem = '';
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async ({ system, user }) => {
          seenSystem = system;
          seenUser = user;
          return {
            text: SAMPLE_REVIEW,
            provider: 'ollama',
            model: 'llama3',
            tokensUsed: 200,
          };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
          difficulty: 'easy',
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
      code: 'def twoSum(nums, target):\n  return [0, 1]',
      action: 'REVIEW',
      message: 'Review my solution like an experienced technical interviewer.',
      lastRunResult: {
        status: 'wrong_answer',
        results: [
          { input: 'public', expectedOutput: '1', isHidden: false },
          { input: 'HIDDEN_INPUT', expectedOutput: 'NOPE', isHidden: true },
        ],
      },
      lastSubmission: {
        verdict: 'wrong_answer',
        passedTests: 1,
        totalTests: 10,
        hiddenExpected: 'leak',
      },
    });

    assert.equal(result.provider, 'ollama');
    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /# Overall Review/);
    assert.match(result.answer, /Final Rating/);
    assert.match(result.answer, /⭐/);
    assert.match(seenSystem, /review\.prompt|Task: REVIEW|technical interviewer/i);
    assert.match(seenUser, /twoSum/);
    assert.match(seenUser, /Latest Run result/);
    assert.doesNotMatch(seenUser, /HIDDEN_INPUT/);
    assert.doesNotMatch(seenUser, /hiddenExpected/);
  });
});
