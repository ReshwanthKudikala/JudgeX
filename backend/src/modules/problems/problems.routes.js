// Declares public problem browsing/detail/creation HTTP endpoints.
// Mounted under /api/v1/problems by the module registry.
//
// All endpoints are public for now. Admin authorization on POST (and future
// admin routes) is deliberately deferred to a later sprint.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { problemsRateLimit } = require('../../middlewares/rate-limit');
const controller = require('./problems.controller');
const editorialController = require('../editorials/editorials.controller');
const discussionController = require('../discussions/discussions.controller');
const {
  listProblemsQuerySchema,
  createProblemSchema,
  problemIdParamsSchema,
  problemSlugRouteParamsSchema,
} = require('./problems.validators');
const { problemSlugParamsSchema } = require('../editorials/editorials.validators');
const {
  listDiscussionsQuerySchema,
  createDiscussionSchema,
  problemSlugParamsSchema: discussionSlugParamsSchema,
} = require('../discussions/discussions.validators');

const router = Router();

router.get(
  '/',
  problemsRateLimit,
  validate(listProblemsQuerySchema, 'query'),
  controller.listProblems,
);
router.post('/', problemsRateLimit, validate(createProblemSchema), controller.createProblem);
router.get(
  '/id/:id',
  problemsRateLimit,
  validate(problemIdParamsSchema, 'params'),
  controller.getProblemById,
);
router.get(
  '/:slug/editorial',
  problemsRateLimit,
  validate(problemSlugParamsSchema, 'params'),
  editorialController.getPublishedBySlug,
);
router.get(
  '/:slug/discussions',
  problemsRateLimit,
  validate(discussionSlugParamsSchema, 'params'),
  validate(listDiscussionsQuerySchema, 'query'),
  discussionController.listDiscussions,
);
router.post(
  '/:slug/discussions',
  authenticate,
  problemsRateLimit,
  validate(discussionSlugParamsSchema, 'params'),
  validate(createDiscussionSchema),
  discussionController.createDiscussion,
);
router.get(
  '/:slug',
  problemsRateLimit,
  validate(problemSlugRouteParamsSchema, 'params'),
  controller.getProblemBySlug,
);

module.exports = { problemRoutes: router };
