/**
 * AI Learning Coach service (Sprint 41 foundation).
 * Single request / single response — no conversation persistence.
 */

const { config } = require('../../config');
const { ValidationError, NotFoundError } = require('../../shared/errors/http-errors');
const { resolveTestCase } = require('../../infrastructure/storage/storage.adapter');
const { problemRepository } = require('../problems/problems.repository');
const { testCaseService } = require('../problems/testcase.service');
const { resolveCoachAction } = require('./coach.actions');
const { sanitizeCoachContext, sanitizePublicExamples } = require('./context-sanitizer');
const { buildCoachPrompt } = require('./prompt-builder');
const { getCoachProvider } = require('./providers/provider.factory');

class CoachService {
  /**
   * @param {object} [deps]
   * @param {{ id: string, model?: string, complete: Function }} [deps.provider]
   * @param {{ findById: Function }} [deps.problems]
   * @param {{ getPublicExamples: Function }} [deps.testCases]
   */
  constructor(deps = {}) {
    this.provider = deps.provider || null;
    this.problems = deps.problems || problemRepository;
    this.testCases = deps.testCases || testCaseService;
  }

  /**
   * @param {object} body - validated coach request
   * @param {string} [_userId]
   */
  async coach(body, _userId) {
    const started = Date.now();
    this.#assertSizeLimits(body);

    const sanitized = sanitizeCoachContext(body);
    const action = resolveCoachAction(sanitized.action);

    const problem = await this.#loadPublicProblem(sanitized.problemId);
    const built = buildCoachPrompt({
      action,
      language: sanitized.language,
      code: sanitized.code,
      message: sanitized.message,
      problem,
      lastRunResult: sanitized.lastRunResult,
      lastSubmission: sanitized.lastSubmission,
      maxCodeChars: config.ai.maxCodeChars,
      maxMessageChars: config.ai.maxMessageChars,
      maxStatementChars: config.ai.maxStatementChars,
    });

    const provider = this.provider || getCoachProvider();
    const completion = await provider.complete({
      system: built.system,
      user: built.user,
      timeoutMs: config.ai.timeoutMs,
    });

    return {
      answer: completion.text,
      provider: completion.provider || provider.id,
      model: completion.model || provider.model || config.ai.ollama.model,
      tokensUsed:
        typeof completion.tokensUsed === 'number' ? completion.tokensUsed : null,
      durationMs: Date.now() - started,
    };
  }

  #assertSizeLimits(body) {
    const code = typeof body.code === 'string' ? body.code : '';
    const message = typeof body.message === 'string' ? body.message : '';

    if (code.length > config.ai.maxCodeChars) {
      throw new ValidationError('Source code exceeds the configured size limit.', {
        field: 'code',
        max: config.ai.maxCodeChars,
        actual: code.length,
      });
    }
    if (message.length > config.ai.maxMessageChars) {
      throw new ValidationError('Message exceeds the configured size limit.', {
        field: 'message',
        max: config.ai.maxMessageChars,
        actual: message.length,
      });
    }
  }

  async #loadPublicProblem(problemId) {
    if (!problemId) {
      throw new ValidationError('problemId is required.');
    }

    const row = await this.problems.findById(problemId);
    if (!row) {
      throw new NotFoundError('Problem not found.');
    }

    const publicRows = await this.testCases.getPublicExamples(row.id);
    return {
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      statement: row.statement || '',
      constraints: row.constraints_text || row.constraintsText || '',
      examples: sanitizePublicExamples(
        publicRows.map((rowEx) => {
          const resolved = resolveTestCase(rowEx);
          return {
            input: resolved.input,
            output: resolved.expectedOutput,
            explanation: rowEx.explanation ?? null,
          };
        }),
      ),
    };
  }
}

const coachService = new CoachService();

module.exports = {
  CoachService,
  coachService,
};
