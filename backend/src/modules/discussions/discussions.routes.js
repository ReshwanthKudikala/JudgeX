// Discussion routes mounted under /api/v1/discussions.
// Problem-scoped list/create live on problems.routes.
// Comment patch/delete live on comments.routes (/api/v1/comments).

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const controller = require('./discussions.controller');
const {
  updateDiscussionSchema,
  createCommentSchema,
  reportSchema,
  discussionIdParamsSchema,
} = require('./discussions.validators');

const router = Router();

router.get(
  '/:id',
  validate(discussionIdParamsSchema, 'params'),
  controller.getDiscussion,
);

router.patch(
  '/:id',
  authenticate,
  validate(discussionIdParamsSchema, 'params'),
  validate(updateDiscussionSchema),
  controller.updateDiscussion,
);

router.delete(
  '/:id',
  authenticate,
  validate(discussionIdParamsSchema, 'params'),
  controller.deleteDiscussion,
);

router.post(
  '/:id/comments',
  authenticate,
  validate(discussionIdParamsSchema, 'params'),
  validate(createCommentSchema),
  controller.createComment,
);

router.post(
  '/:id/report',
  authenticate,
  validate(discussionIdParamsSchema, 'params'),
  validate(reportSchema),
  controller.reportDiscussion,
);

module.exports = { discussionRoutes: router };
