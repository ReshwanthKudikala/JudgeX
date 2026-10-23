/**
 * AI Learning Coach service.
 * Sprint 41–44: foundation, explain, review, progressive hints.
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
  isCoachCodeEmpty,
  mapCoachMarkdownAnswer,
  mapCoachProviderError,
} = require('./explain-code');
const {
  requiresSourceCode,
  emptyCodeMessageForAction,
} = require('./review-solution');
const { parseHintLevel } = require('./progressive-hint');
const {
  NO_PUBLIC_FAILURE_MESSAGE,
  hasPublicFailingTestcase,
} = require('./wrong-answer-debugger');
const {
  appendMissingCoverage,
  appendTruncationNotice,
  missingRequestedInputs,
} = require('./coach-instruction');
const {
  appendVerificationFooter,
  selectVerificationCases,
  shouldVerifyExecution,
  verifyCoachExecution,
} = require('./coach-verify');
const { numPredictForAction } = require('./generation-budget');

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
    this.verifyExecution = deps.verifyExecution || verifyCoachExecution;
  }

  /**
   * @param {object} body - validated coach request
   * @param {string} [_userId]
   */
  async coach(body, _userId) {
    const started = Date.now();
    const prepared = await this.#prepare(body);
    const { sanitized, hintLevel, verification, built } = prepared;
    const provider = this.provider || getCoachProvider();

    let completion;
    try {
      completion = await provider.complete({
        system: built.system,
        user: built.user,
        timeoutMs: config.ai.timeoutMs,
        numPredict: numPredictForAction(built.action, config.ai.ollama.numPredict),
      });
    } catch (err) {
      const mapped = mapCoachProviderError(err);
      if (
        verification.status === 'verified' ||
        verification.status === 'compile_error'
      ) {
        const note = mapped
          ? mapped.message
          : 'The model did not answer. Runtime claims were not checked.';
        return {
          answer: appendVerificationFooter(note, verification),
          provider: provider.id,
          model: provider.model || config.ai.ollama.model,
          tokensUsed: null,
          durationMs: Date.now() - started,
          format: 'markdown',
          hintLevel,
          verification: verification.status,
        };
      }
      if (mapped) {
        throw new AIError(mapped.message, { code: mapped.code });
      }
      throw err;
    }

    const mapped = mapCoachMarkdownAnswer(completion.text, {
      action: built.action,
      hintLevel,
    });
    let answer = mapped.answer;
    if (completion.truncated) {
      answer = appendTruncationNotice(answer);
    }
    const missing = missingRequestedInputs(sanitized.message, answer);
    if (missing.length > 0) {
      answer = appendMissingCoverage(answer, missing);
    }
    answer = appendVerificationFooter(answer, verification);

    return {
      answer,
      verification: verification.status,
      provider: completion.provider || provider.id,
      model: completion.model || provider.model || config.ai.ollama.model,
      tokensUsed:
        typeof completion.tokensUsed === 'number' ? completion.tokensUsed : null,
      durationMs: Date.now() - started,
      format: mapped.format,
      hintLevel: hintLevel ?? mapped.hintLevel ?? null,
      loadMs: completion.loadMs ?? null,
      promptEvalMs: completion.promptEvalMs ?? null,
      evalMs: completion.evalMs ?? null,
      promptTokens: completion.promptTokens ?? null,
      outputTokens: completion.outputTokens ?? null,
    };
  }

  /**
   * Same preparation as coach(), then yield tokens. The done payload includes
   * sandbox evidence even when generation stops early.
   * @param {object} body
   * @param {string} [_userId]
   * @param {{ write: Function, signal?: AbortSignal }} io
   */
  async coachStream(body, _userId, io) {
    const started = Date.now();
    const prepared = await this.#prepare(body);
    const provider = this.provider || getCoachProvider();
    const numPredict = numPredictForAction(prepared.action, config.ai.ollama.numPredict);
    let raw = '';
    let truncated = false;
    /** @type {object} */
    let timing = {};
    try {
      if (typeof provider.completeStream === 'function') {
        for await (const event of provider.completeStream({
          system: prepared.built.system,
          user: prepared.built.user,
          timeoutMs: config.ai.timeoutMs,
          numPredict,
          signal: io.signal,
        })) {
          if (event.type === 'token') {
            raw += event.text;
            io.write('token', { text: event.text });
          } else if (event.type === 'end') {
            raw = event.text;
            truncated = Boolean(event.truncated);
            timing = event;
          }
        }
      } else {
        const completion = await provider.complete({
          system: prepared.built.system,
          user: prepared.built.user,
          timeoutMs: config.ai.timeoutMs,
          numPredict,
          signal: io.signal,
        });
        raw = completion.text;
        truncated = Boolean(completion.truncated);
        timing = completion;
        io.write('token', { text: raw });
      }
    } catch (err) {
      const mapped = mapCoachProviderError(err);
      const note = mapped
        ? mapped.message
        : err instanceof Error
          ? err.message
          : 'The model did not answer.';
      const safeNote = /cancelled|timed out|malformed|empty completion|not found|refused|unavailable/i.test(note)
        ? note
        : 'The model did not answer.';
      const partial = raw.trim()
        ? `${this.#finishAnswer(raw, prepared, false)}\n\n${safeNote}`
        : appendVerificationFooter(safeNote, prepared.verification);
      io.write('done', {
        answer: partial,
        incomplete: true,
        verification: prepared.verification.status,
        durationMs: Date.now() - started,
        provider: provider.id,
        model: provider.model || config.ai.ollama.model,
      });
      return;
    }

    const answer = this.#finishAnswer(raw, prepared, truncated);
    io.write('done', {
      answer,
      incomplete: false,
      verification: prepared.verification.status,
      durationMs: Date.now() - started,
      provider: provider.id,
      model: provider.model || config.ai.ollama.model,
      loadMs: timing.loadMs ?? null,
      promptEvalMs: timing.promptEvalMs ?? null,
      evalMs: timing.evalMs ?? null,
      promptTokens: timing.promptTokens ?? null,
      outputTokens: timing.outputTokens ?? null,
    });
  }

  #finishAnswer(raw, prepared, truncated) {
    const mapped = mapCoachMarkdownAnswer(raw, {
      action: prepared.action,
      hintLevel: prepared.hintLevel,
    });
    let answer = mapped.answer;
    if (truncated) answer = appendTruncationNotice(answer);
    const missing = missingRequestedInputs(prepared.sanitized.message, answer);
    if (missing.length > 0) answer = appendMissingCoverage(answer, missing);
    return appendVerificationFooter(answer, prepared.verification);
  }

  async #prepare(body) {
    this.#assertSizeLimits(body);
    const sanitized = sanitizeCoachContext(body);
    const action = resolveCoachAction(sanitized.action);

    if (requiresSourceCode(action) && isCoachCodeEmpty(sanitized.code)) {
      throw new ValidationError(emptyCodeMessageForAction(action), {
        field: 'code',
        action,
      });
    }

    let hintLevel = null;
    if (action === COACH_ACTIONS.HINT) {
      try {
        hintLevel = parseHintLevel(
          sanitized.hintLevel != null ? sanitized.hintLevel : body.hintLevel,
        );
      } catch (err) {
        throw new ValidationError(
          err instanceof Error
            ? err.message
            : 'hintLevel must be an integer between 1 and 3.',
          { field: 'hintLevel', action },
        );
      }
    }

    if (action === COACH_ACTIONS.WRONG_ANSWER) {
      if (!hasPublicFailingTestcase(sanitized)) {
        throw new ValidationError(NO_PUBLIC_FAILURE_MESSAGE, {
          field: 'lastRunResult',
          action,
        });
      }
    }

    const problem = await this.#loadPublicProblem(sanitized.problemId);
    const verificationCases = selectVerificationCases({
      message: sanitized.message,
      examples: problem.examples,
    });
    let verification = { status: 'skipped', results: [] };
    if (
      sanitized.code.trim() &&
      shouldVerifyExecution(action, verificationCases.length)
    ) {
      try {
        verification = await this.verifyExecution({
          problemId: sanitized.problemId,
          language: sanitized.language,
          sourceCode: sanitized.code,
          cases: verificationCases,
        });
      } catch {
        verification = { status: 'unavailable', results: [] };
      }
    }
    const built = buildCoachPrompt({
      action,
      language: sanitized.language,
      code: sanitized.code,
      message: sanitized.message,
      history: sanitized.history,
      hintLevel,
      problem,
      lastRunResult: sanitized.lastRunResult,
      lastSubmission: sanitized.lastSubmission,
      verification,
      maxCodeChars: config.ai.maxCodeChars,
      maxMessageChars: config.ai.maxMessageChars,
      maxStatementChars: config.ai.maxStatementChars,
    });
    return { sanitized, action, hintLevel, verification, built };
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
