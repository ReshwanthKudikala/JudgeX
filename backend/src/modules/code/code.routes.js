// Declares Run Code HTTP endpoints (API_SPECIFICATION.md §4.2 — sync MVP).
// Mounted under /api/v1/code. Auth required; not scored; no submission rows.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { submissionRateLimit } = require('../../middlewares/rate-limit');
const { runCodeSchema } = require('./code.validators');
const controller = require('./code.controller');

const router = Router();

router.post(
  '/run',
  authenticate,
  // Shares the submission tier: Run also consumes sandbox capacity.
  submissionRateLimit,
  validate(runCodeSchema),
  controller.runCode,
);

module.exports = { codeRoutes: router };
