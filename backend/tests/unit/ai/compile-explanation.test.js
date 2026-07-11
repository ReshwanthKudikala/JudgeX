/**
 * Sprint 15 — AI compile-error explanation unit tests.
 * No Docker / BullMQ / judging; providers are mocked.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal env so config can load if a module pulls it in.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-unit-secret-change-me-32chars!!!';
process.env.FEATURE_AI_COMPILE_EXPLANATION = 'true';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';

const { createAIProvider, resetAIProvider } = require('../../../src/infrastructure/ai-provider/provider.factory');
const { createOllamaProvider } = require('../../../src/infrastructure/ai-provider/ollama.adapter');
const { createOpenAIProvider } = require('../../../src/infrastructure/ai-provider/openai.adapter');
const { AIService } = require('../../../src/modules/ai/ai.service');
const { AIError } = require('../../../src/shared/errors/domain-errors');
const { validateOutput, parseExplanation } = require('../../../src/modules/ai/ai.guardrails');

describe('AI provider selection', () => {
  beforeEach(() => {
    resetAIProvider();
  });

  it('creates an Ollama provider when AI_PROVIDER=ollama', () => {
    const provider = createAIProvider({ provider: 'ollama' });
    assert.equal(provider.id, 'ollama');
    assert.equal(typeof provider.generateCompletion, 'function');
  });

  it('creates an OpenAI provider when AI_PROVIDER=openai', () => {
    const provider = createAIProvider({
      provider: 'openai',
      openai: { apiKey: 'sk-test' },
    });
    assert.equal(provider.id, 'openai');
    assert.equal(typeof provider.generateCompletion, 'function');
  });
});

describe('AI graceful fallback', () => {
  it('tryExplainAfterCompileError returns null when the provider fails', async () => {
    const failingProvider = {
      id: 'mock',
      generateCompletion: async () => {
        throw new AIError('provider down');
      },
    };

    const inserts = [];
    const svc = new AIService({
      provider: failingProvider,
      feedbackRepository: {
        insertFeedback: async (row) => {
          inserts.push(row);
        },
      },
    });

    const result = await svc.tryExplainAfterCompileError({
      submissionId: '00000000-0000-7000-8000-000000000001',
      userId: '00000000-0000-7000-8000-000000000002',
      language: 'python',
      compileOutput: 'SyntaxError: invalid syntax',
    });

    assert.equal(result, null);
    assert.equal(inserts.length, 0);
  });

  it('explainCompileError surfaces AIError when the provider is unavailable', async () => {
    const svc = new AIService({
      provider: {
        generateCompletion: async () => {
          throw new AIError('Ollama is unavailable.');
        },
      },
    });

    await assert.rejects(
      () =>
        svc.explainCompileError({
          language: 'cpp',
          compileOutput: "error: expected ';' before '}' token",
        }),
      (err) => err instanceof AIError && err.code === 'AI_UNAVAILABLE',
    );
  });

  it('Ollama adapter maps HTTP failures to AIError', async () => {
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:9',
      model: 'llama3',
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      }),
    });

    await assert.rejects(
      () =>
        provider.generateCompletion({
          system: 'sys',
          user: 'usr',
          timeoutMs: 1000,
        }),
      (err) => err instanceof AIError,
    );
  });

  it('OpenAI adapter requires an API key', async () => {
    const provider = createOpenAIProvider({ apiKey: '', model: 'gpt-4o-mini' });
    await assert.rejects(
      () => provider.generateCompletion({ system: 's', user: 'u' }),
      (err) => err instanceof AIError,
    );
  });
});

describe('Compile error explanation generation', () => {
  it('returns explanation, likelyCause, and possibleFix from provider JSON', async () => {
    const mockProvider = {
      id: 'mock',
      generateCompletion: async () => ({
        provider: 'mock',
        text: JSON.stringify({
          explanation: 'Missing closing parenthesis in a function definition.',
          likelyCause: 'A ( was opened without a matching ).',
          possibleFix: 'Add the missing ) at the end of the def line.',
        }),
      }),
    };

    const inserts = [];
    const svc = new AIService({
      provider: mockProvider,
      feedbackRepository: {
        insertFeedback: async (row) => {
          inserts.push(row);
          return row;
        },
      },
    });

    const result = await svc.explainCompileError({
      language: 'python',
      compileOutput: 'SyntaxError: invalid syntax (main.py, line 1)',
    });

    assert.equal(result.wasBlocked, false);
    assert.match(result.explanation, /parenthesis/i);
    assert.match(result.likelyCause, /matching/i);
    assert.match(result.possibleFix, /missing/i);
    assert.equal(result.provider, 'mock');

    const afterJudge = await svc.tryExplainAfterCompileError({
      submissionId: '00000000-0000-7000-8000-000000000003',
      userId: '00000000-0000-7000-8000-000000000004',
      language: 'python',
      compileOutput: 'SyntaxError: invalid syntax',
    });

    assert.ok(afterJudge);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].feedbackType, 'compile_explanation');
    assert.equal(inserts[0].wasBlocked, false);
  });

  it('replaces solution-like output with the safe fallback', async () => {
    const hugeSolution = [
      '```python',
      'def solve():',
      '    n = int(input())',
      '    a = list(map(int, input().split()))',
      '    print(sum(a))',
      '    return a',
      'class Solver:',
      '    def run(self):',
      '        pass',
      'int main() { return 0; }',
      'def another():',
      '    pass',
      '```',
    ].join('\n');

    const svc = new AIService({
      provider: {
        generateCompletion: async () => ({ provider: 'mock', text: hugeSolution }),
      },
    });

    const result = await svc.explainCompileError({
      language: 'python',
      compileOutput: 'SyntaxError: invalid syntax',
    });

    assert.equal(result.wasBlocked, true);
    assert.ok(result.explanation.length > 0);
    assert.ok(result.likelyCause.length > 0);
    assert.ok(result.possibleFix.length > 0);
  });

  it('parseExplanation recovers JSON embedded in prose', () => {
    const parsed = parseExplanation(
      'Sure!\n{"explanation":"e","likelyCause":"c","possibleFix":"f"}\nThanks',
    );
    assert.equal(parsed.explanation, 'e');
    assert.equal(parsed.likelyCause, 'c');
    assert.equal(parsed.possibleFix, 'f');
  });

  it('validateOutput accepts short safe replies', () => {
    const result = validateOutput(
      '{"explanation":"bad semicolon","likelyCause":"syntax","possibleFix":"add ;"}',
    );
    assert.equal(result.ok, true);
    assert.equal(result.wasBlocked, false);
  });
});
