// Single entry point for all AI; applies guardrails and delegates to the
// configured provider (ARCHITECTURE.md §9, BACKEND_STRUCTURE.md §5.7).
//
// Non-critical path: failures never affect judging. The worker calls
// tryExplainAfterCompileError(), which swallows every error.

const { config } = require('../../config');
const { logger } = require('../../shared/logger/logger');
const { AppError } = require('../../shared/errors/base.error');
const { AIError } = require('../../shared/errors/domain-errors');
const { ForbiddenError, NotFoundError } = require('../../shared/errors/http-errors');
const { getAIProvider } = require('../../infrastructure/ai-provider/provider.factory');
const { submissionService } = require('../submissions/submissions.service');
const { problemRepository } = require('../problems/problems.repository');
const { aiFeedbackRepository } = require('./ai.repository');
const {
  SAFE_FALLBACK,
  BLOCKED_LEARNING_FALLBACK,
  buildSystemPrompt,
  buildLearningSystemPrompt,
  gateCompileErrorInput,
  gateLanguage,
  gateCode,
  gateMessage,
  gateStatement,
  gateHintLevel,
  buildUserPrompt,
  buildVerdictUserPrompt,
  buildComplexityUserPrompt,
  buildOptimizationUserPrompt,
  buildHintUserPrompt,
  buildAssistantUserPrompt,
  validateOutput,
  parseExplanation,
  parseLearningReply,
} = require('./ai.guardrails');

const EXPLAINABLE_VERDICTS = new Set([
  'compile_error',
  'wrong_answer',
  'runtime_error',
  'tle',
  'memory_limit_exceeded',
]);

class AIService {
  constructor({
    provider,
    submissions = submissionService,
    feedbackRepository = aiFeedbackRepository,
    problems = problemRepository,
  } = {}) {
    this._provider = provider || null;
    this.submissions = submissions;
    this.feedbackRepository = feedbackRepository;
    this.problems = problems;
  }

  get provider() {
    return this._provider || getAIProvider();
  }

  #assertAdvancedEnabled() {
    if (!config.featureFlags.aiAdvanced) {
      throw new AIError('Advanced AI learning features are disabled.');
    }
  }

  /**
   * Core MVP capability: explain a compiler error from language + stderr.
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

    await this.#persistFeedback({
      submissionId,
      userId: requesterUserId,
      feedbackType: 'compile_explanation',
      result: {
        explanation: result.explanation,
        likelyCause: result.likelyCause,
        possibleFix: result.possibleFix,
        wasBlocked: result.wasBlocked,
        provider: result.provider,
      },
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
        feedbackType: 'compile_explanation',
        result: {
          explanation: result.explanation,
          likelyCause: result.likelyCause,
          possibleFix: result.possibleFix,
          wasBlocked: result.wasBlocked,
          provider: result.provider,
        },
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

  async #loadProblemContext(problemId) {
    if (!problemId) return null;
    const row = await this.problems.findById(problemId);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      statement: gateStatement(row.statement || ''),
    };
  }

  async #ownedSubmission(submissionId, userId) {
    const submission = await this.submissions.getSubmissionById(submissionId);
    if (submission.userId !== userId) {
      throw new ForbiddenError('You can only request AI help for your own submissions.');
    }
    return submission;
  }

  async #completeLearning({ system, user, allowSolution = false }) {
    const completion = await this.provider.generateCompletion({ system, user });
    const validated = validateOutput(completion.text, { allowSolution });

    if (validated.wasBlocked || !validated.ok) {
      return {
        ...BLOCKED_LEARNING_FALLBACK,
        wasBlocked: true,
        provider: completion.provider,
      };
    }

    const parsed = parseLearningReply(validated.text);
    return {
      ...parsed,
      wasBlocked: false,
      provider: completion.provider,
    };
  }

  /**
   * Explain WA / RE / TLE / CE (and MLE) for an owned submission.
   */
  async explainSubmissionVerdict(submissionId, requesterUserId) {
    this.#assertAdvancedEnabled();

    const submission = await this.#ownedSubmission(submissionId, requesterUserId);

    if (!EXPLAINABLE_VERDICTS.has(submission.verdict)) {
      throw new AppError('AI verdict explanations are only available for failed submissions.', {
        statusCode: 409,
        code: 'VERDICT_NOT_EXPLAINABLE',
      });
    }

    // CE still supported via advanced path; prefer structured CE when only compile output matters.
    if (submission.verdict === 'compile_error' && submission.compileOutput) {
      const ce = await this.explainCompileError({
        language: submission.language,
        compileOutput: submission.compileOutput,
      });
      const mapped = {
        reply: [ce.explanation, ce.likelyCause, ce.possibleFix].filter(Boolean).join('\n\n'),
        summary: ce.likelyCause,
        timeComplexity: null,
        spaceComplexity: null,
        hintLevel: null,
        wasBlocked: ce.wasBlocked,
        provider: ce.provider,
      };
      await this.#persistLearningFeedback({
        submissionId,
        userId: requesterUserId,
        feedbackType: 'compile_explanation',
        result: mapped,
        promptSnapshot: null,
      });
      return { submissionId, action: 'explain_verdict', ...mapped };
    }

    const problem = await this.#loadProblemContext(submission.problemId);
    let language;
    let sourceCode;
    try {
      language = gateLanguage(submission.language);
      sourceCode = gateCode(submission.sourceCode);
    } catch (err) {
      throw new AppError(err.message, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const user = buildVerdictUserPrompt({
      language,
      verdict: submission.verdict,
      compileOutput: submission.compileOutput
        ? String(submission.compileOutput).slice(0, 4000)
        : null,
      stderr: submission.stderr ? String(submission.stderr).slice(0, 4000) : null,
      stdout: submission.stdout ? String(submission.stdout).slice(0, 2000) : null,
      sourceCode,
      problemTitle: problem?.title,
      statement: problem?.statement,
    });

    const result = await this.#completeLearning({
      system: buildLearningSystemPrompt({ revealSolution: false }),
      user,
    });

    await this.#persistLearningFeedback({
      submissionId,
      userId: requesterUserId,
      feedbackType: 'bug_hint',
      result,
      promptSnapshot: user,
    });

    return { submissionId, action: 'explain_verdict', ...stripProvider(result) };
  }

  async analyzeComplexity({ problemId, language, sourceCode }, userId) {
    this.#assertAdvancedEnabled();

    let lang;
    let code;
    try {
      lang = gateLanguage(language);
      code = gateCode(sourceCode);
    } catch (err) {
      throw new AppError(err.message, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const problem = await this.#requireProblemOptional(problemId);
    const user = buildComplexityUserPrompt({
      language: lang,
      sourceCode: code,
      problemTitle: problem?.title,
      statement: problem?.statement,
    });

    const result = await this.#completeLearning({
      system: buildLearningSystemPrompt({ revealSolution: false }),
      user,
    });

    await this.#persistLearningFeedback({
      submissionId: null,
      userId,
      feedbackType: 'complexity',
      result,
      promptSnapshot: user,
      problemId: problem?.id || null,
    });

    return { action: 'analyze_complexity', ...stripProvider(result) };
  }

  async suggestOptimizations({ problemId, language, sourceCode }, userId) {
    this.#assertAdvancedEnabled();

    let lang;
    let code;
    try {
      lang = gateLanguage(language);
      code = gateCode(sourceCode);
    } catch (err) {
      throw new AppError(err.message, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const problem = await this.#requireProblemOptional(problemId);
    const user = buildOptimizationUserPrompt({
      language: lang,
      sourceCode: code,
      problemTitle: problem?.title,
      statement: problem?.statement,
    });

    const result = await this.#completeLearning({
      system: buildLearningSystemPrompt({ revealSolution: false }),
      user,
    });

    await this.#persistLearningFeedback({
      submissionId: null,
      userId,
      feedbackType: 'optimization',
      result,
      promptSnapshot: user,
      problemId: problem?.id || null,
    });

    return { action: 'suggest_optimizations', ...stripProvider(result) };
  }

  async generateHint({ problemId, hintLevel }, userId) {
    this.#assertAdvancedEnabled();

    let level;
    try {
      level = gateHintLevel(hintLevel);
    } catch (err) {
      throw new AppError(err.message, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const problem = await this.#requireProblem(problemId);
    const user = buildHintUserPrompt({
      hintLevel: level,
      problemTitle: problem.title,
      statement: problem.statement,
      difficulty: problem.difficulty,
    });

    const result = await this.#completeLearning({
      system: buildLearningSystemPrompt({ revealSolution: false }),
      user,
    });

    if (result.hintLevel == null) result.hintLevel = level;

    await this.#persistLearningFeedback({
      submissionId: null,
      userId,
      feedbackType: 'bug_hint',
      result,
      promptSnapshot: user,
      problemId: problem.id,
    });

    return { action: 'generate_hint', problemId, ...stripProvider(result) };
  }

  /**
   * Conversational learning assistant for the problem panel.
   */
  async learningAssist(input, userId) {
    this.#assertAdvancedEnabled();

    const action = String(input.action || 'ask').trim();
    const revealSolution = input.revealSolution === true
      || action === 'reveal_solution'
      || /\b(full solution|complete solution|give me the solution)\b/i.test(input.message || '');

    if (action === 'explain_verdict' || action === 'why_failed') {
      if (!input.submissionId) {
        throw new AppError('submissionId is required to explain a failed submission.', {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
      return this.explainSubmissionVerdict(input.submissionId, userId);
    }

    if (action === 'hint' || action === 'generate_hint') {
      return this.generateHint(
        { problemId: input.problemId, hintLevel: input.hintLevel || 1 },
        userId,
      );
    }

    if (action === 'complexity' || action === 'analyze_complexity') {
      return this.analyzeComplexity(
        {
          problemId: input.problemId,
          language: input.language,
          sourceCode: input.sourceCode,
        },
        userId,
      );
    }

    if (action === 'optimize' || action === 'suggest_optimizations') {
      return this.suggestOptimizations(
        {
          problemId: input.problemId,
          language: input.language,
          sourceCode: input.sourceCode,
        },
        userId,
      );
    }

    const problem = input.problemId
      ? await this.#requireProblem(input.problemId)
      : null;

    let language = null;
    let sourceCode = null;
    let message = null;
    try {
      if (input.language) language = gateLanguage(input.language);
      if (input.sourceCode) sourceCode = gateCode(input.sourceCode);
      if (input.message) message = gateMessage(input.message);
    } catch (err) {
      throw new AppError(err.message, { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    if (!message && !sourceCode) {
      throw new AppError('Provide a message and/or source code.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    let verdict = null;
    if (input.submissionId) {
      const submission = await this.#ownedSubmission(input.submissionId, userId);
      verdict = submission.verdict;
      if (!sourceCode && submission.sourceCode) {
        sourceCode = gateCode(submission.sourceCode);
      }
      if (!language && submission.language) {
        language = gateLanguage(submission.language);
      }
    }

    const user = buildAssistantUserPrompt({
      action,
      language,
      sourceCode,
      message,
      problemTitle: problem?.title,
      statement: problem?.statement,
      verdict,
      revealSolution,
    });

    const result = await this.#completeLearning({
      system: buildLearningSystemPrompt({ revealSolution }),
      user,
      allowSolution: revealSolution,
    });

    await this.#persistLearningFeedback({
      submissionId: input.submissionId || null,
      userId,
      feedbackType: 'edge_cases',
      result,
      promptSnapshot: user,
      problemId: problem?.id || null,
    });

    return { action, ...stripProvider(result) };
  }

  async #requireProblem(problemId) {
    if (!problemId) throw new NotFoundError('Problem not found.');
    const problem = await this.#loadProblemContext(problemId);
    if (!problem) throw new NotFoundError('Problem not found.');
    return problem;
  }

  async #requireProblemOptional(problemId) {
    if (!problemId) return null;
    const problem = await this.#loadProblemContext(problemId);
    if (!problem) throw new NotFoundError('Problem not found.');
    return problem;
  }

  async #persistFeedback({ submissionId, userId, feedbackType, result, promptSnapshot }) {
    try {
      await this.feedbackRepository.insertFeedback({
        submissionId,
        userId,
        feedbackType: feedbackType || 'compile_explanation',
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

  async #persistLearningFeedback({
    submissionId,
    userId,
    feedbackType,
    result,
    promptSnapshot,
    problemId,
  }) {
    try {
      // ai_feedback.submission_id may be required — skip persist when no submission.
      if (!submissionId) {
        logger.info('Skipping AI feedback persist without submissionId', {
          feedbackType,
          problemId,
        });
        return;
      }
      await this.feedbackRepository.insertFeedback({
        submissionId,
        userId,
        feedbackType,
        promptSnapshot,
        responseText: JSON.stringify({
          reply: result.reply,
          summary: result.summary,
          timeComplexity: result.timeComplexity,
          spaceComplexity: result.spaceComplexity,
          hintLevel: result.hintLevel,
        }),
        wasBlocked: result.wasBlocked,
        provider: result.provider || 'unknown',
      });
    } catch (err) {
      logger.warn('Failed to persist AI learning feedback; continuing', {
        submissionId,
        feedbackType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function stripProvider(result) {
  return {
    reply: result.reply,
    summary: result.summary,
    timeComplexity: result.timeComplexity,
    spaceComplexity: result.spaceComplexity,
    hintLevel: result.hintLevel,
    wasBlocked: result.wasBlocked,
  };
}

module.exports = {
  AIService,
  aiService: new AIService(),
};
