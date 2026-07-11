// Admin contest HTTP controllers (RBAC applied in admin.routes).

const { contestService } = require('../contests/contests.service');
const { sendSuccess } = require('../../shared/http/response');

async function createContest(req, res, next) {
  try {
    const contest = await contestService.createContest(req.body, req.user.id);
    sendSuccess(req, res, 201, contest);
  } catch (err) {
    next(err);
  }
}

async function updateContest(req, res, next) {
  try {
    const contest = await contestService.updateContest(req.params.id, req.body);
    sendSuccess(req, res, 200, contest);
  } catch (err) {
    next(err);
  }
}

async function deleteContest(req, res, next) {
  try {
    const result = await contestService.deleteContest(req.params.id);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function getContest(req, res, next) {
  try {
    const contest = await contestService.getContestAdmin(req.params.id);
    sendSuccess(req, res, 200, contest);
  } catch (err) {
    next(err);
  }
}

module.exports = { createContest, updateContest, deleteContest, getContest };
