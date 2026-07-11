// Submission intake: validate, persist as queued, then enqueue the judge job
// (persist-before-enqueue). This file owns intake + lifecycle business rules.
//
// Business logic only: no SQL, no Express/HTTP, no Docker, and no verdict
// calculation. Persistence is delegated to SubmissionRepository; queueing goes
// through the queue service AFTER the DB transaction commits. Verdicts are
// computed elsewhere (the judge worker) and merely persisted here.

const { withTransaction } = require('../../infrastructure/database/transaction');
const { enqueueSubmission } = require('../../infrastructure/queue/queue.service');
const { logger } = require('../../shared/logger/logger');
const { NotFoundError, ValidationError } = require('../../shared/errors/http-errors');
const { QueueError } = require('../../shared/errors/domain-errors');
const { submissionRepository } = require('./submissions.repository');
const { userRepository } = require('../auth/auth.repository');
const { problemRepository } = require('../problems/problems.repository');

// The MVP verdicts the worker may report (DATABASE_DESIGN.md §3.7 `verdict` enum).
const TERMINAL_VERDICTS = new Set([
  'accepted',
  'wrong_answer',
  'tle',
  'runtime_error',
  'compile_error',
]);

// Map a full submissions row into a camelCase domain object.
function toSubmissionDetail(row) {
  return {
    id: row.id,
    userId: row.user_id,
    problemId: row.problem_id,
    language: row.language,
    sourceCode: row.source_code,
    status: row.status,
    verdict: row.verdict,
    compileOutput: row.compile_output,
    runtimeMs: row.runtime_ms,
    memoryKb: row.memory_kb,
    failedTestIndex: row.failed_test_index,
    submittedAt: row.submitted_at,
    judgedAt: row.judged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Map a lightweight history row (no source_code/compile_output) into a summary.
function toSubmissionSummary(row) {
  return {
    id: row.id,
    userId: row.user_id,
    problemId: row.problem_id,
    language: row.language,
    status: row.status,
    verdict: row.verdict,
    runtimeMs: row.runtime_ms,
    memoryKb: row.memory_kb,
    failedTestIndex: row.failed_test_index,
    submittedAt: row.submitted_at,
    judgedAt: row.judged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SubmissionService {
  constructor({
    submissionRepository: subRepo,
    userRepository: usrRepo,
    problemRepository: probRepo,
    enqueueSubmission: enqueueFn,
  } = {}) {
    this.submissionRepository = subRepo || submissionRepository;
    this.userRepository = usrRepo || userRepository;
    this.problemRepository = probRepo || problemRepository;
    this.enqueueSubmission = enqueueFn || enqueueSubmission;
  }

  /**
   * Create a submission in the initial 'queued' status, then enqueue it for
   * judging (persist-before-enqueue).
   *
   * 1. Transaction: verify user + problem exist, insert the submission.
   * 2. After COMMIT: enqueue via the queue service (never inside the TX).
   *
   * If enqueue fails, the row stays `queued` (recoverable by a reaper) and a
   * QueueError is thrown — the submission is never deleted.
   *
   * @param {{ userId: string, problemId: string, language: string, sourceCode: string }} input
   * @returns {Promise<Object>} the created submission domain object (status 'queued').
   * @throws {NotFoundError} when the user or problem does not exist.
   * @throws {QueueError} when enqueue fails after a successful persist.
   */
  async createSubmission({ userId, problemId, language, sourceCode }) {
    const submission = await withTransaction(async (client) => {
      const user = await this.userRepository.findById(userId, client);
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      const problem = await this.problemRepository.findById(problemId, client);
      if (!problem) {
        throw new NotFoundError('Problem not found.');
      }

      const row = await this.submissionRepository.createSubmission(
        { userId, problemId, language, sourceCode },
        client,
      );
      return toSubmissionDetail(row);
    });

    // Enqueue ONLY after the transaction has committed. A job must never
    // reference a submission that is not yet durable in Postgres.
    try {
      await this.enqueueSubmission(submission.id);
    } catch (err) {
      logger.error('Failed to enqueue submission; leaving row in queued state for recovery', {
        submissionId: submission.id,
        error: err.message,
      });
      if (err instanceof QueueError) throw err;
      throw new QueueError('Failed to enqueue submission for judging.', {
        submissionId: submission.id,
        cause: err.message,
      });
    }

    return submission;
  }

  /**
   * Fetch a single submission by id.
   * @param {string} id - UUID.
   * @returns {Promise<Object>} the submission domain object.
   * @throws {NotFoundError} when no submission has that id.
   */
  async getSubmissionById(id) {
    const row = await this.submissionRepository.findById(id);
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }

  /**
   * Paginated, filtered, sorted history of one user's submissions.
   * @param {string} userId - UUID.
   * @param {Object} [filters] - { page, limit, sort, problemId, verdict, language, status }.
   * @returns {Promise<{ submissions: Object[], pagination: { page, limit, total, totalPages } }>}
   */
  async getUserSubmissions(userId, filters = {}) {
    const { rows, total, page, limit } = await this.submissionRepository.findByUser(userId, filters);
    return {
      submissions: rows.map(toSubmissionSummary),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  /**
   * Transition a submission to 'running' (the worker has picked it up).
   * @param {string} id - UUID.
   * @returns {Promise<Object>} the updated submission domain object.
   * @throws {NotFoundError} when no submission has that id.
   */
  async markSubmissionRunning(id) {
    const row = await this.submissionRepository.updateSubmissionStatus(id, 'running');
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }

  /**
   * Persist the terminal result the worker computed. This service does NOT
   * decide the verdict — it only validates and stores what it is given, and
   * derives the lifecycle status ('completed') from the presence of a verdict.
   *
   * @param {string} id - UUID.
   * @param {{ verdict: string, compileOutput?: string|null, runtimeMs?: number|null,
   *           memoryKb?: number|null, failedTestIndex?: number|null }} result
   * @returns {Promise<Object>} the updated submission domain object.
   * @throws {ValidationError} when the verdict is not a known terminal verdict.
   * @throws {NotFoundError} when no submission has that id.
   */
  async completeSubmission(id, result = {}) {
    const { verdict, compileOutput, runtimeMs, memoryKb, failedTestIndex } = result;

    if (!TERMINAL_VERDICTS.has(verdict)) {
      throw new ValidationError('Unknown submission verdict.', [
        { field: 'verdict', issue: 'must be a valid terminal verdict' },
      ]);
    }

    const row = await this.submissionRepository.updateSubmissionResult(id, {
      status: 'completed',
      verdict,
      compileOutput,
      runtimeMs,
      memoryKb,
      failedTestIndex,
    });
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }
}

module.exports = { SubmissionService, submissionService: new SubmissionService() };
