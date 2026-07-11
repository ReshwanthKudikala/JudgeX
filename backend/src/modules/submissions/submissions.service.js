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
const {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} = require('../../shared/errors/http-errors');
const { QueueError } = require('../../shared/errors/domain-errors');
const { submissionRepository } = require('./submissions.repository');
const { userRepository } = require('../auth/auth.repository');
const { problemRepository } = require('../problems/problems.repository');

// Terminal verdicts the worker may report (DB enum + Sprint 25 extensions).
const TERMINAL_VERDICTS = new Set([
  'accepted',
  'wrong_answer',
  'tle',
  'runtime_error',
  'compile_error',
  'memory_limit_exceeded',
  'internal_error',
]);

function toProblemSummary(row) {
  if (!row || !row.problem_id) return null;
  return {
    id: row.problem_id,
    slug: row.problem_slug,
    title: row.problem_title,
    difficulty: row.problem_difficulty,
  };
}

// Map a full submissions row into a camelCase domain object.
function toSubmissionDetail(row) {
  const problem = toProblemSummary(row);
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
    // Sprint 25/26 aliases (same persisted values).
    executionTime: row.runtime_ms,
    runtime: row.runtime_ms,
    memoryKb: row.memory_kb,
    memory: row.memory_kb,
    failedTestIndex: row.failed_test_index,
    passedTests: row.passed_tests ?? null,
    totalTests: row.total_tests ?? null,
    stdout: row.stdout ?? null,
    stderr: row.stderr ?? null,
    submittedAt: row.submitted_at,
    judgedAt: row.judged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(problem ? { problem } : {}),
  };
}

// Map a lightweight history row (no source_code/compile_output) into a summary.
function toSubmissionSummary(row) {
  const problem = toProblemSummary(row);
  return {
    id: row.id,
    userId: row.user_id,
    problemId: row.problem_id,
    language: row.language,
    status: row.status,
    verdict: row.verdict,
    runtimeMs: row.runtime_ms,
    executionTime: row.runtime_ms,
    runtime: row.runtime_ms,
    memoryKb: row.memory_kb,
    memory: row.memory_kb,
    failedTestIndex: row.failed_test_index,
    passedTests: row.passed_tests ?? null,
    totalTests: row.total_tests ?? null,
    submittedAt: row.submitted_at,
    judgedAt: row.judged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(problem ? { problem } : {}),
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
   * @param {{ userId: string, problemId: string, language: string, sourceCode: string }} input
   * @returns {Promise<Object>} the created submission domain object (status 'queued').
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
   * Internal fetch by id (judge worker). No ownership check.
   * @param {string} id
   */
  async getSubmissionById(id) {
    const row = await this.submissionRepository.findById(id);
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }

  /**
   * Owner-or-admin detail fetch with problem summary (HTTP GET /submissions/:id).
   *
   * @param {string} id
   * @param {{ id: string, role?: string }} viewer - authenticated DB user
   */
  async getSubmissionForViewer(id, viewer) {
    const row = await this.submissionRepository.findByIdWithProblem(id);
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }

    const isOwner = viewer && viewer.id === row.user_id;
    const isAdmin = viewer && viewer.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have access to this submission.');
    }

    return toSubmissionDetail(row);
  }

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
   * Profile progress aggregates + recent feeds for the authenticated user.
   * @param {string} userId
   */
  async getUserProgress(userId) {
    const statsRow = await this.submissionRepository.getUserProgressStats(userId);
    const totalSubmissions = statsRow ? Number(statsRow.total_submissions) || 0 : 0;
    const totalAccepted = statsRow ? Number(statsRow.total_accepted) || 0 : 0;
    const problemsSolved = statsRow ? Number(statsRow.problems_solved) || 0 : 0;
    const acceptanceRate =
      totalSubmissions > 0
        ? Math.round((totalAccepted / totalSubmissions) * 10000) / 100
        : 0;

    const { rows: recentRows } = await this.submissionRepository.findByUser(userId, {
      page: 1,
      limit: 5,
    });
    const recentAcceptedProblems = await this.submissionRepository.findRecentAcceptedProblems(
      userId,
      { limit: 5 },
    );

    return {
      problemsSolved,
      totalSubmissions,
      totalAccepted,
      acceptanceRate,
      favouriteLanguage: statsRow?.favourite_language ?? null,
      recentSubmissions: recentRows.map(toSubmissionSummary),
      recentAcceptedProblems: recentAcceptedProblems.map((row) => ({
        problemId: row.problem_id,
        slug: row.problem_slug,
        title: row.problem_title,
        difficulty: row.problem_difficulty,
        submittedAt: row.submitted_at,
        submissionId: row.submission_id,
      })),
    };
  }

  async markSubmissionRunning(id) {
    const row = await this.submissionRepository.updateSubmissionStatus(id, 'running');
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }

  /**
   * Persist the terminal result the worker computed. This service does NOT
   * decide the verdict — it only validates and stores what it is given.
   *
   * @param {string} id - UUID.
   * @param {object} result
   * @returns {Promise<Object>}
   */
  async completeSubmission(id, result = {}) {
    const {
      verdict,
      compileOutput,
      runtimeMs,
      memoryKb,
      failedTestIndex,
      passedTests,
      totalTests,
      stdout,
      stderr,
      status = 'completed',
    } = result;

    if (!TERMINAL_VERDICTS.has(verdict)) {
      throw new ValidationError('Unknown submission verdict.', [
        { field: 'verdict', issue: 'must be a valid terminal verdict' },
      ]);
    }

    const row = await this.submissionRepository.updateSubmissionResult(id, {
      status,
      verdict,
      compileOutput,
      runtimeMs,
      memoryKb,
      failedTestIndex,
      passedTests,
      totalTests,
      stdout,
      stderr,
    });
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }

  /**
   * Mark a submission as an internal judging failure (Sprint 25).
   *
   * @param {string} id
   * @param {{ message?: string }} [opts]
   */
  async failSubmissionInternal(id, opts = {}) {
    const row = await this.submissionRepository.updateSubmissionResult(id, {
      status: 'error',
      verdict: 'internal_error',
      compileOutput: opts.message || null,
      runtimeMs: null,
      memoryKb: null,
      failedTestIndex: null,
      passedTests: null,
      totalTests: null,
      stdout: null,
      stderr: opts.message || null,
    });
    if (!row) {
      throw new NotFoundError('Submission not found.');
    }
    return toSubmissionDetail(row);
  }
}

module.exports = {
  SubmissionService,
  submissionService: new SubmissionService(),
  TERMINAL_VERDICTS,
};
