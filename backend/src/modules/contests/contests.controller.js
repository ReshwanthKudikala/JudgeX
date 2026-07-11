// Public contest HTTP controllers.

const { contestService } = require('./contests.service');
const { sendSuccess } = require('../../shared/http/response');

async function listContests(req, res, next) {
  try {
    const { contests, pagination } = await contestService.listContests(req.query, req.user || null);
    sendSuccess(req, res, 200, contests, { pagination });
  } catch (err) {
    next(err);
  }
}

async function getContest(req, res, next) {
  try {
    const contest = await contestService.getContestById(req.params.id, req.user || null);
    sendSuccess(req, res, 200, contest);
  } catch (err) {
    next(err);
  }
}

async function joinContest(req, res, next) {
  try {
    const result = await contestService.joinContest(req.params.id, req.user.id);
    sendSuccess(req, res, result.alreadyJoined ? 200 : 201, result);
  } catch (err) {
    next(err);
  }
}

async function getContestProblems(req, res, next) {
  try {
    const result = await contestService.getContestProblems(req.params.id, req.user || null);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function getScoreboard(req, res, next) {
  try {
    const result = await contestService.getScoreboard(req.params.id, req.query);
    sendSuccess(req, res, 200, result.entries, {
      pagination: result.pagination,
      contestId: result.contestId,
      status: result.status,
      participantCount: result.participantCount,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listContests,
  getContest,
  joinContest,
  getContestProblems,
  getScoreboard,
};
