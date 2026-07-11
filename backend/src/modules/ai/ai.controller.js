// Translates AI HTTP requests to AIService calls.

const { aiService } = require('./ai.service');
const { sendSuccess } = require('../../shared/http/response');

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

async function explainSubmission(req, res, next) {
  try {
    const data = await aiService.explainSubmissionVerdict(
      req.body.submissionId,
      req.user.id,
    );
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function analyzeComplexity(req, res, next) {
  try {
    const data = await aiService.analyzeComplexity(req.body, req.user.id);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function suggestOptimizations(req, res, next) {
  try {
    const data = await aiService.suggestOptimizations(req.body, req.user.id);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function generateHint(req, res, next) {
  try {
    const data = await aiService.generateHint(req.body, req.user.id);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function learningAssist(req, res, next) {
  try {
    const data = await aiService.learningAssist(req.body, req.user.id);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  explainCompileError,
  explainSubmission,
  analyzeComplexity,
  suggestOptimizations,
  generateHint,
  learningAssist,
};
