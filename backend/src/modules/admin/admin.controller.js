// Translates admin HTTP requests to AdminService calls.
//
// Thin controllers: read the (validated) request, call one AdminService method,
// emit the standard response envelope, and forward errors to next(). No business
// logic, SQL, validation, or HTTP-error construction.

const { adminService } = require('./admin.service');
const { sendSuccess } = require('../../shared/http/response');

// POST /admin/problems → 201 { ...problem }
async function createProblem(req, res, next) {
  try {
    const problem = await adminService.createProblem(req.body);
    sendSuccess(req, res, 201, problem);
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/problems/:id → 200 { ...problem }
async function updateProblem(req, res, next) {
  try {
    const problem = await adminService.updateProblem(req.params.id, req.body);
    sendSuccess(req, res, 200, problem);
  } catch (err) {
    next(err);
  }
}

// DELETE /admin/problems/:id → 200 { id, deleted: true }
async function deleteProblem(req, res, next) {
  try {
    const result = await adminService.deleteProblem(req.params.id);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

// PUT /admin/problems/:id/testcases → 200 { problemId, count }
async function replaceTestCases(req, res, next) {
  try {
    const inserted = await adminService.replaceTestCases(req.params.id, req.body.testCases);
    sendSuccess(req, res, 200, { problemId: req.params.id, count: inserted.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { createProblem, updateProblem, deleteProblem, replaceTestCases };
