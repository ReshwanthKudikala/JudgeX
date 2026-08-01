/**
 * AI Learning Coach service.
 * Sprint 41 foundation + Sprint 42 Explain My Code reference path.
 */

const { config } = require('../../config');
const { ValidationError, NotFoundError } = require('../../shared/errors/http-errors');
const { AIError } = require('../../shared/errors/domain-errors');
const { resolveTestCase } = require('../../infrastructure/storage/storage.adapter');
const { problemRepository } = require('../problems/problems.repository');
const { testCaseService } = require('../problems/testcase.service');
const { COACH_ACTIONS, resolveCoachAction } = require('./coach.actions');
const { sanitizeCoachContext, sanitizePublicExamples } = require('./context-sanitizer');
const { buildCoachPrompt } = require('./prompt-builder');
const { getCoachProvider } = require('./providers/provider.factory');
const {
  EMPTY_CODE_MESSAGE,
  isCoachCodeEmpty,
  mapCoachMarkdownAnswer,
  mapCoachProviderError,
} = require('./explain-code');

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

    // Explain My Code (and future code-first actions): validate before provider.
    if (action === COACH_ACTIONS.EXPLAIN_CODE && isCoachCodeEmpty(sanitized.code)) {
      throw new ValidationError(EMPTY_CODE_MESSAGE, {
        field: 'code',
        action: COACH_ACTIONS.EXPLAIN_CODE,
      });
    }

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

    let completion;
    try {
      completion = await provider.complete({
        system: built.system,
        user: built.user,
        timeoutMs: config.ai.timeoutMs,
      });
    } catch (err) {
      const mapped = mapCoachProviderError(err);
      if (mapped) {
        throw new AIError(mapped.message, { code: mapped.code });
      }
      throw err;
    }

    const mapped = mapCoachMarkdownAnswer(completion.text, { action: built.action });

    return {
      answer: mapped.answer,
      provider: completion.provider || provider.id,
      model: completion.model || provider.model || config.ai.ollama.model,
      tokensUsed:
        typeof completion.tokensUsed === 'number' ? completion.tokensUsed : null,
      durationMs: Date.now() - started,
      format: mapped.format,
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
