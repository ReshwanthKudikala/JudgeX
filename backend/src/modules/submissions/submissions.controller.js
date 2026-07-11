// Translates submission HTTP requests to SubmissionService calls.
//
// Thin controllers: read the request, call exactly one service method, emit the
// standard response envelope, and forward errors to next(). No business logic,
// SQL, HTTP-error construction, verdict calculation, queue, or Docker concerns.
// The authenticated user is supplied by the authenticate middleware (req.user).

const { submissionService } = require('./submissions.service');
const { sendSuccess } = require('../../shared/http/response');
const { metrics } = require('../../shared/observability/metrics');

// POST /submissions → 202 { ...submission } (judging is asynchronous)
async function createSubmission(req, res, next) {
  try {
    const { problemId, language, sourceCode } = req.body;
    const submission = await submissionService.createSubmission({
      userId: req.user.id,
      problemId,
      language,
      sourceCode,
      requestId: req.requestId || req.correlationId,
    });
    metrics.recordSubmissionCreated(language);
    sendSuccess(req, res, 202, submission);
  } catch (err) {
    next(err);
  }
}

// GET /submissions/:id → 200 { ...submission } (owner or admin)
async function getSubmissionById(req, res, next) {
  try {
    const submission = await submissionService.getSubmissionForViewer(req.params.id, req.user);
    sendSuccess(req, res, 200, submission);
  } catch (err) {
    next(err);
  }
}

// GET /submissions → 200 [ ...summaries ] with meta.pagination (current user's history)
async function getUserSubmissions(req, res, next) {
  try {
    const { submissions, pagination } = await submissionService.getUserSubmissions(
      req.user.id,
      req.query,
    );
    sendSuccess(req, res, 200, submissions, { pagination });
  } catch (err) {
    next(err);
  }
}

// GET /submissions/stats → 200 progress aggregates for the current user
async function getUserProgress(req, res, next) {
  try {
    const progress = await submissionService.getUserProgress(req.user.id);
    sendSuccess(req, res, 200, progress);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSubmission,
  getSubmissionById,
  getUserSubmissions,
  getUserProgress,
};
