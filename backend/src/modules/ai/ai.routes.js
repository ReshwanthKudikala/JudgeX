// Declares AI assistant HTTP endpoints (API_SPECIFICATION.md §7).
// Mounted under /api/v1/ai. Auth required; AI is a non-critical path.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
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
  validate(explainCompileErrorSchema),
  controller.explainCompileError,
);

router.post(
  '/explain-submission',
  authenticate,
  validate(explainSubmissionSchema),
  controller.explainSubmission,
);

router.post(
  '/analyze-complexity',
  authenticate,
  validate(analyzeComplexitySchema),
  controller.analyzeComplexity,
);

router.post(
  '/suggest-optimizations',
  authenticate,
  validate(suggestOptimizationsSchema),
  controller.suggestOptimizations,
);

router.post(
  '/generate-hint',
  authenticate,
  validate(generateHintSchema),
  controller.generateHint,
);

router.post(
  '/learning-assist',
  authenticate,
  validate(learningAssistSchema),
  controller.learningAssist,
);

module.exports = { aiRoutes: router };
