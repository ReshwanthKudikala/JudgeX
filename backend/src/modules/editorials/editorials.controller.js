// Public editorial HTTP controllers.

const { editorialService } = require('./editorials.service');
const { sendSuccess } = require('../../shared/http/response');

async function getPublishedBySlug(req, res, next) {
  try {
    const data = await editorialService.getPublishedBySlug(req.params.slug);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublishedBySlug };
