// Declares AI assistant HTTP endpoints (API_SPECIFICATION.md §7).
// Mounted under /api/v1/ai. Auth required; AI is a non-critical path.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { aiRateLimit } = require('../../middlewares/rate-limit');
const {
  explainCompileErrorSchema,
  explainSubmissionSchema,
  analyzeComplexitySchema,
  suggestOptimizationsSchema,
  generateHintSchema,
  learningAssistSchema,
} = require('./ai.validators');
const controller = require('./ai.controller');

const router = Router();

router.post(
  '/explain-compile-error',
  authenticate,
  aiRateLimit,
  validate(explainCompileErrorSchema),
  controller.explainCompileError,
);

router.post(
  '/explain-submission',
  authenticate,
  aiRateLimit,
  validate(explainSubmissionSchema),
  controller.explainSubmission,
);

router.post(
  '/analyze-complexity',
  authenticate,
  aiRateLimit,
  validate(analyzeComplexitySchema),
  controller.analyzeComplexity,
);

router.post(
  '/suggest-optimizations',
  authenticate,
  aiRateLimit,
  validate(suggestOptimizationsSchema),
  controller.suggestOptimizations,
);

router.post(
  '/generate-hint',
  authenticate,
  aiRateLimit,
  validate(generateHintSchema),
  controller.generateHint,
);

router.post(
  '/learning-assist',
  authenticate,
  aiRateLimit,
  validate(learningAssistSchema),
  controller.learningAssist,
);

module.exports = { aiRoutes: router };
