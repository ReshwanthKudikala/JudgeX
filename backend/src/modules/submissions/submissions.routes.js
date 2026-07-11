// Declares submission HTTP endpoints and attaches middleware.
// Mounted under /api/v1/submissions by the module registry.
//
// Every endpoint requires authentication: a submission is always owned by, and
// scoped to, the authenticated user (identity comes from req.user, never the body).

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { submissionRateLimit } = require('../../middlewares/rate-limit');
const {
  createSubmissionSchema,
  listSubmissionsQuerySchema,
  submissionIdParamsSchema,
} = require('./submissions.validators');
const controller = require('./submissions.controller');

const router = Router();

router.post(
  '/',
  authenticate,
  submissionRateLimit,
  validate(createSubmissionSchema),
  controller.createSubmission,
);
router.get('/', authenticate, validate(listSubmissionsQuerySchema, 'query'), controller.getUserSubmissions);
// Static path before /:id so "stats" is not treated as a UUID.
router.get('/stats', authenticate, controller.getUserProgress);
router.get(
  '/:id',
  authenticate,
  validate(submissionIdParamsSchema, 'params'),
  controller.getSubmissionById,
);

module.exports = { submissionRoutes: router };
