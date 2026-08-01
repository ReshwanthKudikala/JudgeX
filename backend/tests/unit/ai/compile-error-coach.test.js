/**
 * Sprint 47 — Compile Error coach unit tests (mocked provider).
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
  COMPILE_ERROR_SECTIONS,
  hasCompileErrorContext,
  mapCompileErrorMarkdownAnswer,
} = require('../../../src/modules/ai/compile-error-coach');
const { mapCoachMarkdownAnswer } = require('../../../src/modules/ai/explain-code');
const { resetCoachProvider } = require('../../../src/modules/ai/providers/provider.factory');

const PROBLEM_ID = '00000000-0000-7000-8000-000000000011';

const SAMPLE = `# Likely Cause
Missing semicolon or syntax error near line 3.

# Explanation
The compiler stopped because the statement was incomplete.

# Possible Fix
Close the statement and rebuild. Check brackets around the failing line.

# Learning Tip
Read the first error line first — later errors are often cascading.`;

describe('Compile Error coach — routing', () => {
  it('routes compile_error aliases to COMPILE_ERROR', () => {
    assert.equal(resolveCoachAction('COMPILE_ERROR'), COACH_ACTIONS.COMPILE_ERROR);
    assert.equal(resolveCoachAction('compile_error'), COACH_ACTIONS.COMPILE_ERROR);
  });

  it('selects compile-error.prompt.md', () => {
    assert.equal(ACTION_PROMPT_FILES[COACH_ACTIONS.COMPILE_ERROR], 'compile-error.prompt.md');
  });
});

describe('Compile Error coach — prompt & sanitizer', () => {
  afterEach(() => clearPromptTemplateCache());

  it('builds prompt with compile output and strips hidden tests', () => {
    const sanitized = sanitizeCoachContext({
      problemId: PROBLEM_ID,
      language: 'cpp',
      code: 'int main() { return 0 }',
      action: 'COMPILE_ERROR',
      lastSubmission: {
        verdict: 'compile_error',
        compileOutput: "error: expected ';' before '}'",
        hiddenExpected: 'leak',
      },
      lastRunResult: {
        status: 'compile_error',
        results: [{ input: 'SECRET', isHidden: true, passed: false }],
      },
    });

    assert.equal(sanitized.lastSubmission.hiddenExpected, undefined);
    assert.equal(sanitized.lastRunResult.results.length, 0);
    assert.equal(
      hasCompileErrorContext({
        lastSubmission: sanitized.lastSubmission,
        lastRunResult: sanitized.lastRunResult,
      }),
      true,
    );

    const built = buildCoachPrompt({
      action: 'COMPILE_ERROR',
      language: 'cpp',
      code: sanitized.code,
      message: 'Explain compile error',
      problem: { title: 'A+B', statement: 'Add two numbers.', constraints: '', examples: [] },
      lastRunResult: sanitized.lastRunResult,
      lastSubmission: sanitized.lastSubmission,
    });

    assert.equal(built.action, COACH_ACTIONS.COMPILE_ERROR);
    assert.match(built.system, /Task: COMPILE_ERROR/);
    assert.match(built.system, /Likely Cause/);
    assert.match(built.system, /rewrite their entire program/i);
    assert.match(built.user, /expected/);
    assert.doesNotMatch(built.user, /SECRET|leak/);
    assert.ok(COMPILE_ERROR_SECTIONS.includes('Possible Fix'));
  });
});

describe('Compile Error coach — markdown', () => {
  it('maps structured sections', () => {
    const mapped = mapCompileErrorMarkdownAnswer(SAMPLE, {
      action: COACH_ACTIONS.COMPILE_ERROR,
    });
    assert.equal(mapped.format, 'markdown');
    assert.ok(mapped.sectionsFound.includes('Likely Cause'));
  });

  it('routes via mapCoachMarkdownAnswer', () => {
    const mapped = mapCoachMarkdownAnswer('Syntax error near brace.', {
      action: COACH_ACTIONS.COMPILE_ERROR,
    });
    assert.match(mapped.answer, /^# Likely Cause/);
  });
});

describe('Compile Error coach — mocked provider', () => {
  beforeEach(() => resetCoachProvider());
  afterEach(() => resetCoachProvider());

  it('returns markdown explanation from coach path', async () => {
    const svc = new CoachService({
      provider: {
        id: 'ollama',
        model: 'llama3',
        complete: async () => ({
          text: SAMPLE,
          provider: 'ollama',
          model: 'llama3',
          tokensUsed: 40,
        }),
      },
      problems: {
        findById: async () => ({
          id: PROBLEM_ID,
          title: 'A+B',
          statement: 'Add.',
        }),
      },
      testCases: { getPublicExamples: async () => [] },
    });

    const result = await svc.coach({
      problemId: PROBLEM_ID,
      language: 'cpp',
      code: 'int main(){return 0}',
      action: 'COMPILE_ERROR',
      message: 'Help with compile error',
      lastSubmission: {
        verdict: 'compile_error',
        compileOutput: "error: expected ';' ",
      },
    });

    assert.equal(result.format, 'markdown');
    assert.match(result.answer, /Likely Cause/);
    assert.match(result.answer, /Possible Fix/);
  });
});
