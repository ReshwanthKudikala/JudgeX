// Admin editorial HTTP controllers (RBAC applied in admin.routes).

const { editorialService } = require('../editorials/editorials.service');
const { sendSuccess } = require('../../shared/http/response');

async function createEditorial(req, res, next) {
  try {
    const editorial = await editorialService.createEditorial(
      req.params.problemId,
      req.body,
      req.user.id,
    );
    sendSuccess(req, res, 201, editorial);
  } catch (err) {
    next(err);
  }
}

async function updateEditorial(req, res, next) {
  try {
    const editorial = await editorialService.updateEditorial(req.params.id, req.body);
    sendSuccess(req, res, 200, editorial);
  } catch (err) {
    next(err);
  }
}

async function deleteEditorial(req, res, next) {
  try {
    const result = await editorialService.deleteEditorial(req.params.id);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function getEditorial(req, res, next) {
  try {
    const editorial = await editorialService.getEditorialAdmin(req.params.id);
    sendSuccess(req, res, 200, editorial);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createEditorial,
  updateEditorial,
  deleteEditorial,
  getEditorial,
};
