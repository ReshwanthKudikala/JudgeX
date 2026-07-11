// Declares AI assistant HTTP endpoints (API_SPECIFICATION.md §7).
// Mounted under /api/v1/ai. Auth required; AI is a non-critical path.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { explainCompileErrorSchema } = require('./ai.validators');
const controller = require('./ai.controller');

const router = Router();

router.post(
  '/explain-compile-error',
  authenticate,
  validate(explainCompileErrorSchema),
  controller.explainCompileError,
);

module.exports = { aiRoutes: router };
