// Translates problem HTTP requests to ProblemService calls.
//
// Thin controllers: read the request, call exactly one service method, emit the
// standard response envelope, and forward errors to next(). No business logic,
// SQL, validation, pagination math, HTTP-error construction, or DTO mapping.

const { problemService } = require('./problems.service');
const { sendSuccess } = require('../../shared/http/response');

// GET /problems → 200 [ ...summaries ] with meta.pagination
async function listProblems(req, res, next) {
  try {
    const { problems, pagination } = await problemService.listProblems(req.query);
    sendSuccess(req, res, 200, problems, { pagination });
  } catch (err) {
    next(err);
  }
}

// GET /problems/:slug → 200 { ...problem }
async function getProblemBySlug(req, res, next) {
  try {
    const problem = await problemService.getProblemBySlug(req.params.slug);
    sendSuccess(req, res, 200, problem);
  } catch (err) {
    next(err);
  }
}

// GET /problems/id/:id → 200 { ...problem }
async function getProblemById(req, res, next) {
  try {
    const problem = await problemService.getProblemById(req.params.id);
    sendSuccess(req, res, 200, problem);
  } catch (err) {
    next(err);
  }
}

// POST /problems → 201 { ...problem }
async function createProblem(req, res, next) {
  try {
    const problem = await problemService.createProblem(req.body);
    sendSuccess(req, res, 201, problem);
  } catch (err) {
    next(err);
  }
}

module.exports = { listProblems, getProblemBySlug, getProblemById, createProblem };
