// Translates AI HTTP requests to AIService calls.

const { aiService } = require('./ai.service');
const { sendSuccess } = require('../../shared/http/response');

// POST /ai/explain-compile-error → 200
async function explainCompileError(req, res, next) {
  try {
    const data = await aiService.explainCompileErrorForSubmission(
      req.body.submissionId,
      req.user.id,
    );
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { explainCompileError };
