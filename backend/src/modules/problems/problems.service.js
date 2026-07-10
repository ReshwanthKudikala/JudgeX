// Problems business logic: list/search/filter, detail, and creation.
//
// Business logic only: no SQL, no Express req/res, no request validation, no
// HTTP status codes, no DTO/HTTP shaping. Persistence is delegated to
// ProblemRepository; multi-step atomicity uses the database transaction manager.

const { withTransaction } = require('../../infrastructure/database/transaction');
const { AppError } = require('../../shared/errors/base.error');
const { NotFoundError, ConflictError } = require('../../shared/errors/http-errors');
const { problemRepository } = require('./problems.repository');

// pg returns BIGINT as a string; normalize counters to numbers for the domain.
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Derived business metric: acceptance rate (%) rounded to two decimals.
function acceptanceRate(totalAccepted, totalSubmissions) {
  if (totalSubmissions <= 0) return 0;
  return Math.round((totalAccepted / totalSubmissions) * 10000) / 100;
}

// Map a full problems row (detail/create) into a camelCase domain object.
function toProblemDetail(row) {
  const totalSubmissions = toNumber(row.total_submissions);
  const totalAccepted = toNumber(row.total_accepted);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    statement: row.statement,
    constraintsText: row.constraints_text,
    difficulty: row.difficulty,
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
    totalSubmissions,
    totalAccepted,
    acceptanceRate: acceptanceRate(totalAccepted, totalSubmissions),
    isPublished: row.is_published,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Map a lightweight list row into a camelCase catalog summary (no statement).
function toProblemSummary(row) {
  const totalSubmissions = toNumber(row.total_submissions);
  const totalAccepted = toNumber(row.total_accepted);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
    totalSubmissions,
    totalAccepted,
    acceptanceRate: acceptanceRate(totalAccepted, totalSubmissions),
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ProblemService {
  constructor({ problemRepository: repo } = {}) {
    this.problemRepository = repo || problemRepository;
  }

  /**
   * Fetch a single active problem by slug.
   * @param {string} slug
   * @returns {Promise<Object>} the problem domain object.
   * @throws {NotFoundError} when no active problem has that slug.
   */
  async getProblemBySlug(slug) {
    const row = await this.problemRepository.findBySlug(slug);
    if (!row) {
      throw new NotFoundError('Problem not found.');
    }
    return toProblemDetail(row);
  }

  /**
   * Fetch a single active problem by id.
   * @param {string} id - UUID.
   * @returns {Promise<Object>} the problem domain object.
   * @throws {NotFoundError} when no active problem has that id.
   */
  async getProblemById(id) {
    const row = await this.problemRepository.findById(id);
    if (!row) {
      throw new NotFoundError('Problem not found.');
    }
    return toProblemDetail(row);
  }

  /**
   * Paginated, filtered, sorted catalog listing.
   * @param {Object} [filters] - { page, limit, sort, difficulty, isPublished, createdBy }.
   * @returns {Promise<{ problems: Object[], pagination: { page, limit, total, totalPages } }>}
   */
  async listProblems(filters = {}) {
    const { rows, total, page, limit } = await this.problemRepository.listProblems(filters);
    return {
      problems: rows.map(toProblemSummary),
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  /**
   * Create a new problem.
   *
   * The slug is pre-checked for uniqueness inside a transaction for a friendly
   * error, but the database UNIQUE constraint remains the real guarantee: a
   * concurrent insert (or a slug reserved by a soft-deleted problem, which the
   * pre-check cannot see) is caught as a ConflictError and remapped.
   *
   * @param {Object} data - problem fields (already validated by an outer layer).
   * @returns {Promise<Object>} the created problem domain object.
   * @throws {ConflictError} when the slug is already in use.
   */
  async createProblem(data) {
    return withTransaction(async (client) => {
      const existing = await this.problemRepository.findBySlug(data.slug, client);
      if (existing) {
        throw ProblemService.#slugConflict();
      }

      try {
        const row = await this.problemRepository.createProblem(data, client);
        return toProblemDetail(row);
      } catch (err) {
        // Race / soft-deleted-slug collision: the DB constraint is authoritative.
        if (err instanceof ConflictError) {
          throw ProblemService.#slugConflict();
        }
        throw err;
      }
    });
  }

  static #slugConflict() {
    return new AppError('A problem with this slug already exists.', {
      statusCode: 409,
      code: 'SLUG_ALREADY_EXISTS',
    });
  }
}

module.exports = { ProblemService, problemService: new ProblemService() };
