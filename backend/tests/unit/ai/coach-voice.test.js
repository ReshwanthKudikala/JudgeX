/**
 * Coach voice is a prompt instruction. These tests do not call Ollama.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildCoachPrompt } = require('../../../src/modules/ai/prompt-builder');
const { classifyCoachScope, REFUSAL_MESSAGE } = require('../../../src/modules/ai/coach-scope');

const PROBLEM = {
  title: 'Two Sum',
  statement: 'Find two indices.',
  constraints: '1 <= n <= 1e5',
};

function built(action, extra = {}) {
  return buildCoachPrompt({
    action,
    language: 'python',
    code: 'def solve(nums):\n    return nums\n',
    message: extra.message || 'Look at this function.',
    problem: PROBLEM,
    history: extra.history || [],
    hintLevel: extra.hintLevel,
    verification: extra.verification,
  });
}

describe('coach voice', () => {
  it('tells every action to speak to the user and keep sandbox evidence', () => {
    for (const action of ['EXPLAIN_CODE', 'REVIEW', 'HINT', 'UNKNOWN']) {
      const prompt = built(action, { hintLevel: action === 'HINT' ? 1 : undefined });
      assert.match(prompt.system, /Speak to the user/);
      assert.match(prompt.system, /your code/);
      assert.match(prompt.system, /Never call the user the candidate/);
      assert.match(prompt.system, /Verified execution section is sandbox output/);
      assert.match(prompt.system, /Treat it as fact/);
      assert.doesNotMatch(prompt.system, /reviewing a candidate/i);
    }
  });

  it('keeps explain as teaching and review as a direct code review', () => {
    const explain = built('EXPLAIN_CODE', { message: 'Explain my current code.' });
    assert.match(explain.system, /Task: EXPLAIN_CODE/);
    assert.match(explain.system, /Do not turn this into a formal assessment/);
    assert.match(explain.system, /# Overview/);

    const review = built('REVIEW', { message: 'Review my code and tell me the important issues.' });
    assert.match(review.system, /Task: REVIEW/);
    assert.match(review.system, /Address them as "you"/);
    assert.match(review.system, /# Overall Review/);
    assert.match(review.system, /trace the submitted source/i);
    assert.doesNotMatch(review.system, /the programmer should/i);
  });

  it('keeps hints short and withholds the full solution', () => {
    const hint = built('HINT', {
      hintLevel: 1,
      message: 'Give me a subtle hint about this algorithm.',
    });
    assert.match(hint.system, /Task: HINT/);
    assert.match(hint.system, /Do not reveal the full solution/);
    assert.match(hint.system, /Do NOT generate complete code/i);
    assert.match(hint.user, /Level 1/);
  });

  it('uses the same voice on a follow-up and still requires a correction', () => {
    const followUp = built('UNKNOWN', {
      message: 'Re-evaluate your earlier review. It was incorrect.',
      history: [
        { role: 'user', content: 'Explain this function.' },
        { role: 'assistant', content: 'This loop is fine.' },
      ],
    });
    assert.match(followUp.system, /Speak to the user/);
    assert.match(followUp.system, /Task: UNKNOWN/);
    assert.match(followUp.user, /The earlier claim was wrong/);
    assert.match(followUp.user, /Current source code section/);
  });

  it('passes verified sandbox output through and still refuses out-of-scope chat', () => {
    const review = built('REVIEW', {
      message: 'Review my code.',
      verification: {
        status: 'verified',
        results: [{ input: '0', expected: 'false', stdout: 'true', ok: false }],
      },
    });
    assert.match(review.user, /Verified execution/);
    assert.equal(
      classifyCoachScope({
        action: 'UNKNOWN',
        message: 'Write a pornographic story.',
        history: [],
      }).answer,
      REFUSAL_MESSAGE,
    );
    assert.equal(
      classifyCoachScope({
        action: 'UNKNOWN',
        message: 'continue',
        history: [{ role: 'user', content: 'Write a pornographic story.' }],
      }).decision,
      'refuse',
    );
  });
});
