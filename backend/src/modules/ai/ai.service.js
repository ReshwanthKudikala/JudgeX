// Single entry point for all AI; applies guardrails and delegates to the
// configured provider (ARCHITECTURE.md §9, BACKEND_STRUCTURE.md §5.7).
//
// Non-critical path: failures never affect judging. The worker calls
// tryExplainAfterCompileError(), which swallows every error.

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { AppError } = require('../../shared/errors/base.error');
const { AIError } = require('../../shared/errors/domain-errors');
const { ForbiddenError } = require('../../shared/errors/http-errors');
const { getAIProvider } = require('../../infrastructure/ai-provider/provider.factory');
const { submissionService } = require('../submissions/submissions.service');
const { aiFeedbackRepository } = require('./ai.repository');
const {
  SAFE_FALLBACK,
  buildSystemPrompt,
  gateCompileErrorInput,
  buildUserPrompt,
  validateOutput,
  parseExplanation,
} = require('./ai.guardrails');

class AIService {
  constructor({
    provider,
    submissions = submissionService,
    feedbackRepository = aiFeedbackRepository,
  } = {}) {
    this._provider = provider || null;
    this.submissions = submissions;
    this.feedbackRepository = feedbackRepository;
  }

  get provider() {
    return this._provider || getAIProvider();
  }

  /**
   * Core MVP capability: explain a compiler error from language + stderr.
   *
   * @param {{ language: string, compileOutput: string }} input
   * @returns {Promise<{ explanation: string, likelyCause: string, possibleFix: string, wasBlocked: boolean, provider: string }>}
   * @throws {AIError} when the provider is down / times out / misconfigured.
   * @throws {AppError} when the feature flag is off or input is invalid.
   */
  async explainCompileError({ language, compileOutput }) {
    if (!config.featureFlags.aiCompileExplanation) {
      throw new AIError('Compile-error explanations are disabled.');
    }

    let gated;
    try {
      gated = gateCompileErrorInput({ language, compileOutput });
    } catch (err) {
      throw new AppError(err.message, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const system = buildSystemPrompt();
    const user = buildUserPrompt(gated);

    const completion = await this.provider.generateCompletion({ system, user });
    const validated = validateOutput(completion.text);

    if (validated.wasBlocked || !validated.ok) {
      return {
        ...SAFE_FALLBACK,
        wasBlocked: true,
        provider: completion.provider,
      };
    }

    const parsed = parseExplanation(validated.text);
    return {
      ...parsed,
      wasBlocked: false,
      provider: completion.provider,
    };
  }

  /**
   * HTTP entry: explain a submission the caller owns (API_SPECIFICATION.md §7.1).
   * @param {string} submissionId
   * @param {string} requesterUserId
   */
  async explainCompileErrorForSubmission(submissionId, requesterUserId) {
    const submission = await this.submissions.getSubmissionById(submissionId);

    if (submission.userId !== requesterUserId) {
      throw new ForbiddenError('You can only request AI help for your own submissions.');
    }

    if (submission.verdict !== 'compile_error') {
      throw new AppError('AI explanations are only available for compile-error submissions.', {
        statusCode: 409,
        code: 'NOT_A_COMPILE_ERROR',
      });
    }

    if (!submission.compileOutput) {
      throw new AppError('This submission has no compiler output to explain.', {
        statusCode: 409,
        code: 'NOT_A_COMPILE_ERROR',
      });
    }

    const result = await this.explainCompileError({
      language: submission.language,
      compileOutput: submission.compileOutput,
    });

    // Best-effort persist for audit (DATABASE_DESIGN.md §9.4). Never fail the request.
    await this.#persistFeedback({
      submissionId,
      userId: requesterUserId,
      result,
      promptSnapshot: buildUserPrompt(
        gateCompileErrorInput({
          language: submission.language,
          compileOutput: submission.compileOutput,
        }),
      ),
    });

    return {
      submissionId,
      explanation: result.explanation,
      likelyCause: result.likelyCause,
      possibleFix: result.possibleFix,
      wasBlocked: result.wasBlocked,
    };
  }

  /**
   * Judge-worker hook after a compile_error verdict.
   * Attempts explanation + persist; NEVER throws (judging already finished).
   *
   * @param {{ submissionId: string, userId: string, language: string, compileOutput: string|null }} ctx
   * @returns {Promise<object|null>} the explanation, or null on any failure / skip.
   */
  async tryExplainAfterCompileError(ctx) {
    try {
      if (!config.featureFlags.aiCompileExplanation) return null;
      if (!ctx || !ctx.compileOutput) return null;

      const result = await this.explainCompileError({
        language: ctx.language,
        compileOutput: ctx.compileOutput,
      });

      await this.#persistFeedback({
        submissionId: ctx.submissionId,
        userId: ctx.userId,
        result,
        promptSnapshot: null,
      });

      return result;
    } catch (err) {
      logger.warn('AI compile explanation skipped after judging', {
        submissionId: ctx && ctx.submissionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async #persistFeedback({ submissionId, userId, result, promptSnapshot }) {
    try {
      await this.feedbackRepository.insertFeedback({
        submissionId,
        userId,
        feedbackType: 'compile_explanation',
        promptSnapshot,
        responseText: JSON.stringify({
          explanation: result.explanation,
          likelyCause: result.likelyCause,
          possibleFix: result.possibleFix,
        }),
        wasBlocked: result.wasBlocked,
        provider: result.provider || 'unknown',
      });
    } catch (err) {
      logger.warn('Failed to persist AI feedback; continuing', {
        submissionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

module.exports = {
  AIService,
  aiService: new AIService(),
};
