/**
 * Sprint 44 — Progressive Hint System unit tests (mocked provider).
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
  parseHintLevel,
  coerceHintLevel,
  mapHintMarkdownAnswer,
  REVEAL_EDITORIAL_MESSAGE,
} = require('../../../src/modules/ai/progressive-hint');
const { mapCoachMarkdownAnswer } = require('../../../src/modules/ai/explain-code');
const { ValidationError } = require('../../../src/shared/errors/http-errors');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000010';

describe('Progressive hints — level routing & validation', () => {
  it('routes hint aliases to HINT', () => {
    assert.equal(resolveCoachAction('HINT'), COACH_ACTIONS.HINT);
    assert.equal(resolveCoachAction('hint'), COACH_ACTIONS.HINT);
    assert.equal(resolveCoachAction('generate_hint'), COACH_ACTIONS.HINT);
  });

  it('selects hint.prompt.md', () => {
    assert.equal(ACTION_PROMPT_FILES[COACH_ACTIONS.HINT], 'hint.prompt.md');
  });

  it('validates hint levels 1-3', () => {
    assert.equal(parseHintLevel(1), 1);
    assert.equal(parseHintLevel('2'), 2);
    assert.equal(parseHintLevel(3), 3);
    assert.throws(() => parseHintLevel(0));
    assert.throws(() => parseHintLevel(4));
    assert.throws(() => parseHintLevel('x'));
    assert.equal(coerceHintLevel(null), null);
  });

  it('rejects HINT without a valid hintLevel before provider', async () => {
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
          action: 'HINT',
          message: 'hint please',
        }),
      (err) => err instanceof ValidationError && called === false,
    );
  });
});

describe('Progressive hints — prompt includes level', () => {
  afterEach(() => clearPromptTemplateCache());

  it('injects hint level guidance and omits run/submit noise', () => {
    const built = buildCoachPrompt({
      action: 'HINT',
      hintLevel: 2,
      language: 'python',
      code: 'def solve():\n  pass',
      message: 'Need a nudge',
      problem: {
        title: 'Two Sum',
        statement: 'Find two numbers.',
        constraints: 'n <= 1e4',
        examples: [{ input: '1 2', output: '0 1', explanation: null }],
      },
      lastRunResult: {
        results: [{ input: 'SECRET', isHidden: true }],
      },
    });

    assert.equal(built.action, COACH_ACTIONS.HINT);
    assert.equal(built.meta.hintLevel, 2);
    assert.equal(built.meta.codeFocused, true);
    assert.match(built.system, /Task: HINT/);
    assert.match(built.system, /Level 2/);
    assert.match(built.user, /Hint level/);
    assert.match(built.user, /Level 2/);
    assert.match(built.user, /Concrete/);
    assert.match(built.user, /Two Sum/);
    assert.doesNotMatch(built.user, /Latest Run result/);
    assert.doesNotMatch(built.user, /SECRET/);
  });
});

describe('Progressive hints — sanitization', () => {
  it('keeps hintLevel and strips hidden run payloads', () => {
    const sanitized = sanitizeCoachContext({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'x',
      action: 'HINT',
      hintLevel: 1,
      message: 'subtle',
      lastRunResult: {
        results: [
          { input: 'ok', isHidden: false },
          { input: 'nope', isHidden: true },
        ],
      },
    });
    assert.equal(sanitized.hintLevel, 1);
    assert.equal(sanitized.lastRunResult.results.length, 1);
  });
});

describe('Progressive hints — markdown mapping', () => {
  it('wraps plain text under Hint N', () => {
    const mapped = mapHintMarkdownAnswer('Think about pairs.', { hintLevel: 1 });
    assert.match(mapped.answer, /^# Hint 1/);
    assert.equal(mapped.hintLevel, 1);
  });

  it('routes HINT through mapCoachMarkdownAnswer', () => {
    const mapped = mapCoachMarkdownAnswer('Can a hash map help?', {
      action: COACH_ACTIONS.HINT,
      hintLevel: 2,
    });
    assert.match(mapped.answer, /Hint 2|hash map/i);
  });
});

describe('Progressive hints — mocked provider', () => {
  beforeEach(() => resetCoachProvider());
  afterEach(() => resetCoachProvider());

  it('returns level-1 hint without code dumps or hidden context', async () => {
    let seenUser = '';
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async ({ user }) => {
          seenUser = user;
          return {
            text: 'Think about whether you can avoid checking every pair.',
            provider: 'ollama',
            model: 'llama3',
            tokensUsed: 40,
          };
        },
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'Two Sum',
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
      code: 'for i in range(n):\n  for j in range(i+1, n): ...',
      action: 'HINT',
      hintLevel: 1,
      message: 'Give me a subtle Hint 1',
      lastRunResult: {
        results: [{ input: 'HIDDEN', isHidden: true }],
      },
    });

    assert.equal(result.hintLevel, 1);
    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /Hint 1|avoid checking every pair/i);
    assert.doesNotMatch(result.answer, /```/);
    assert.match(seenUser, /Level 1/);
    assert.doesNotMatch(seenUser, /HIDDEN/);
  });

  it('returns distinct prompts for levels 2 and 3', async () => {
    const levelsSeen = [];
    const svc = new CoachService({
      provider: {
        id: 'mock',
        complete: async ({ user }) => {
          const m = /Level (\d)/.exec(user);
          levelsSeen.push(Number(m && m[1]));
          return {
            text:
              levelsSeen.at(-1) === 2
                ? 'Can a hash map help you find values you\'ve already processed?'
                : 'While iterating, compute the complement and check whether you\'ve already seen it.',
            provider: 'mock',
          };
        },
      },
      problems: {
        findById: async () => ({ id: PROBLEM_ID, title: 'Two Sum', statement: 'S' }),
      },
      testCases: { getPublicExamples: async () => [] },
    });

    const r2 = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'pass',
      action: 'HINT',
      hintLevel: 2,
    });
    const r3 = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'python',
      code: 'pass',
      action: 'HINT',
      hintLevel: 3,
    });

    assert.deepEqual(levelsSeen, [2, 3]);
    assert.match(r2.answer, /hash map/i);
    assert.match(r3.answer, /complement/i);
  });
});

describe('Reveal Editorial placeholder', () => {
  it('exposes the fixed editorial prompt copy', () => {
    assert.equal(
      REVEAL_EDITORIAL_MESSAGE,
      'Would you like to open the Editorial instead?',
    );
  });
});

describe('Frontend hint unlock helpers (session rules)', () => {
  // Mirrors frontend/src/features/ai-assistant/hint-progress.ts
  function canRequestHint(unlockedThrough, level) {
    if (level === 1) return true;
    return unlockedThrough >= level - 1;
  }
  function afterSuccessfulHint(unlockedThrough, level) {
    return Math.max(unlockedThrough, level);
  }
  function showRevealEditorial(unlockedThrough) {
    return unlockedThrough >= 3;
  }
  function resetHintProgress() {
    return 0;
  }

  it('unlocks progressively and resets on problem change', () => {
    assert.equal(canRequestHint(0, 1), true);
    assert.equal(canRequestHint(0, 2), false);
    assert.equal(canRequestHint(1, 2), true);
    assert.equal(canRequestHint(2, 3), true);
    assert.equal(showRevealEditorial(2), false);
    assert.equal(showRevealEditorial(3), true);
    assert.equal(afterSuccessfulHint(0, 1), 1);
    assert.equal(afterSuccessfulHint(1, 3), 3);
    assert.equal(resetHintProgress(), 0);
  });
});
