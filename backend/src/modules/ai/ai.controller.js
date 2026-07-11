// Translates AI HTTP requests to AIService calls.
// Observability: request-scoped logging + metrics only (no AI logic changes).

const { aiService } = require('./ai.service');
const { sendSuccess } = require('../../shared/http/response');
const { metrics } = require('../../shared/observability/metrics');

function wrapAi(endpoint, handler) {
  return async (req, res, next) => {
    const started = Date.now();
    const log = req.log || require('../../shared/logger/logger').logger;
    try {
      await handler(req, res);
      metrics.recordAiRequest(endpoint, 'ok');
      log.info('ai_request', {
        endpoint,
        userId: req.user?.id || null,
        durationMs: Date.now() - started,
        result: 'ok',
      });
    } catch (err) {
      metrics.recordAiRequest(endpoint, 'error');
      log.warn('ai_request', {
        endpoint,
        userId: req.user?.id || null,
        durationMs: Date.now() - started,
        result: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  };
}

async function explainCompileError(req, res) {
  const data = await aiService.explainCompileErrorForSubmission(
    req.body.submissionId,
    req.user.id,
  );
  sendSuccess(req, res, 200, data);
}

async function explainSubmission(req, res) {
  const data = await aiService.explainSubmissionVerdict(
    req.body.submissionId,
    req.user.id,
  );
  sendSuccess(req, res, 200, data);
}

async function analyzeComplexity(req, res) {
  const data = await aiService.analyzeComplexity(req.body, req.user.id);
  sendSuccess(req, res, 200, data);
}

async function suggestOptimizations(req, res) {
  const data = await aiService.suggestOptimizations(req.body, req.user.id);
  sendSuccess(req, res, 200, data);
}

async function generateHint(req, res) {
  const data = await aiService.generateHint(req.body, req.user.id);
  sendSuccess(req, res, 200, data);
}

async function learningAssist(req, res) {
  const data = await aiService.learningAssist(req.body, req.user.id);
  sendSuccess(req, res, 200, data);
}

module.exports = {
  explainCompileError: wrapAi('explain-compile-error', explainCompileError),
  explainSubmission: wrapAi('explain-submission', explainSubmission),
  analyzeComplexity: wrapAi('analyze-complexity', analyzeComplexity),
  suggestOptimizations: wrapAi('suggest-optimizations', suggestOptimizations),
  generateHint: wrapAi('generate-hint', generateHint),
  learningAssist: wrapAi('learning-assist', learningAssist),
};
