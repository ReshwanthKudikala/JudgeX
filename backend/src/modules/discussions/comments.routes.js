// Comment moderation routes mounted under /api/v1/comments.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const controller = require('./discussions.controller');
const {
  updateCommentSchema,
  reportSchema,
  commentIdParamsSchema,
} = require('./discussions.validators');

const router = Router();

router.patch(
  '/:id',
  authenticate,
  validate(commentIdParamsSchema, 'params'),
  validate(updateCommentSchema),
  controller.updateComment,
);

router.delete(
  '/:id',
  authenticate,
  validate(commentIdParamsSchema, 'params'),
  controller.deleteComment,
);

router.post(
  '/:id/report',
  authenticate,
  validate(commentIdParamsSchema, 'params'),
  validate(reportSchema),
  controller.reportComment,
);

module.exports = { commentRoutes: router };
