const { discussionService } = require('./discussions.service');
const { sendSuccess } = require('../../shared/http/response');

async function listDiscussions(req, res, next) {
  try {
    const { discussions, pagination } = await discussionService.listDiscussions(
      req.params.slug,
      req.query,
    );
    sendSuccess(req, res, 200, discussions, { pagination });
  } catch (err) {
    next(err);
  }
}

async function createDiscussion(req, res, next) {
  try {
    const discussion = await discussionService.createDiscussion(
      req.params.slug,
      req.body,
      req.user,
    );
    sendSuccess(req, res, 201, discussion);
  } catch (err) {
    next(err);
  }
}

async function getDiscussion(req, res, next) {
  try {
    const discussion = await discussionService.getDiscussion(req.params.id);
    sendSuccess(req, res, 200, discussion);
  } catch (err) {
    next(err);
  }
}

async function updateDiscussion(req, res, next) {
  try {
    const discussion = await discussionService.updateDiscussion(
      req.params.id,
      req.body,
      req.user,
    );
    sendSuccess(req, res, 200, discussion);
  } catch (err) {
    next(err);
  }
}

async function deleteDiscussion(req, res, next) {
  try {
    const result = await discussionService.deleteDiscussion(req.params.id, req.user);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function createComment(req, res, next) {
  try {
    const comment = await discussionService.createComment(
      req.params.id,
      req.body,
      req.user,
    );
    sendSuccess(req, res, 201, comment);
  } catch (err) {
    next(err);
  }
}

async function updateComment(req, res, next) {
  try {
    const comment = await discussionService.updateComment(
      req.params.id,
      req.body,
      req.user,
    );
    sendSuccess(req, res, 200, comment);
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const result = await discussionService.deleteComment(req.params.id, req.user);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function reportDiscussion(req, res, next) {
  try {
    const report = await discussionService.reportDiscussion(
      req.params.id,
      req.body.reason,
      req.user,
    );
    sendSuccess(req, res, 201, report);
  } catch (err) {
    next(err);
  }
}

async function reportComment(req, res, next) {
  try {
    const report = await discussionService.reportComment(
      req.params.id,
      req.body.reason,
      req.user,
    );
    sendSuccess(req, res, 201, report);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDiscussions,
  createDiscussion,
  getDiscussion,
  updateDiscussion,
  deleteDiscussion,
  createComment,
  updateComment,
  deleteComment,
  reportDiscussion,
  reportComment,
};
