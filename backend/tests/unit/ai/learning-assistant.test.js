/**
 * Sprint 29 — AI learning assistant unit tests (mocked provider).
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.FEATURE_AI_COMPILE_EXPLANATION = 'true';
process.env.FEATURE_AI_ADVANCED = 'true';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';

const { AIService } = require('../../../src/modules/ai/ai.service');
const {
  parseLearningReply,
  gateHintLevel,
  validateOutput,
} = require('../../../src/modules/ai/ai.guardrails');

describe('AI learning guardrails', () => {
  it('parses learning JSON replies', () => {
    const parsed = parseLearningReply(
      JSON.stringify({
        reply: 'Try a hash map.',
        summary: 'Hashing',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        hintLevel: 2,
      }),
    );
    assert.equal(parsed.reply, 'Try a hash map.');
    assert.equal(parsed.timeComplexity, 'O(n)');
    assert.equal(parsed.hintLevel, 2);
  });

  it('validates hint levels', () => {
    assert.equal(gateHintLevel(3), 3);
    assert.throws(() => gateHintLevel(5));
  });

  it('blocks large fenced solutions unless allowSolution', () => {
    const fence = `\`\`\`python\n${'print(1)\n'.repeat(20)}\`\`\``;
    const blocked = validateOutput(fence);
    assert.equal(blocked.wasBlocked, true);
    const allowed = validateOutput(fence, { allowSolution: true });
    assert.equal(allowed.wasBlocked, false);
  });
});

describe('AI learning service', () => {
  beforeEach(() => {
    // no-op; provider injected per test
  });

  it('generateHint returns progressive coaching text', async () => {
    const svc = new AIService({
      provider: {
        id: 'mock',
        generateCompletion: async () => ({
          text: JSON.stringify({
            reply: 'Consider sorting then two pointers.',
            summary: 'Two pointers',
            timeComplexity: null,
            spaceComplexity: null,
            hintLevel: 2,
          }),
          provider: 'mock',
        }),
      },
      problems: {
        findById: async () => ({
          id: '00000000-0000-7000-8000-000000000010',
          title: 'Two Sum',
          difficulty: 'easy',
          statement: 'Find two numbers that add to target.',
        }),
      },
      feedbackRepository: {
        insertFeedback: async () => ({}),
      },
    });

    const result = await svc.generateHint(
      {
        problemId: '00000000-0000-7000-8000-000000000010',
        hintLevel: 2,
      },
      '00000000-0000-7000-8000-000000000001',
    );

    assert.equal(result.action, 'generate_hint');
    assert.match(result.reply, /two pointers/i);
    assert.equal(result.hintLevel, 2);
    assert.equal(result.wasBlocked, false);
  });

  it('explainSubmissionVerdict refuses accepted verdicts', async () => {
    const svc = new AIService({
      provider: {
        id: 'mock',
        generateCompletion: async () => ({ text: '{}', provider: 'mock' }),
      },
      submissions: {
        getSubmissionById: async () => ({
          id: '00000000-0000-7000-8000-000000000020',
          userId: '00000000-0000-7000-8000-000000000001',
          problemId: '00000000-0000-7000-8000-000000000010',
          language: 'python',
          sourceCode: 'print(1)',
          verdict: 'accepted',
          compileOutput: null,
          stderr: null,
          stdout: '1',
        }),
      },
    });

    await assert.rejects(
      () =>
        svc.explainSubmissionVerdict(
          '00000000-0000-7000-8000-000000000020',
          '00000000-0000-7000-8000-000000000001',
        ),
      (err) => err.code === 'VERDICT_NOT_EXPLAINABLE',
    );
  });
});
