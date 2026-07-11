// Test case business logic: atomic replace, CRUD, judge loading, public examples.
//
// Business logic only: no SQL, no Express/HTTP, no judging, no storage/object
// resolution. Persistence is delegated to TestCaseRepository; existence checks
// reuse ProblemRepository; multi-step atomicity uses the transaction manager.
//
// Visibility: hidden expected outputs are exposed ONLY via getJudgeTestCases()
// and admin list/get (never public HTTP). getPublicExamples() returns samples.

const { withTransaction } = require('../../infrastructure/database/transaction');
const { NotFoundError } = require('../../shared/errors/http-errors');
const { testCaseRepository } = require('./testcase.repository');
const { problemRepository } = require('./problems.repository');

class TestCaseService {
  constructor({ testCaseRepository: tcRepo, problemRepository: probRepo } = {}) {
    this.testCaseRepository = tcRepo || testCaseRepository;
    this.problemRepository = probRepo || problemRepository;
  }

  /**
   * Replace a problem's entire test-case set atomically (delete-all + bulk
   * insert) inside one transaction. Display order is preserved from each item's
   * displayOrder, falling back to array index (handled by the repository).
   *
   * @param {string} problemId
   * @param {Array<Object>} testCases - repository-shaped case data.
   * @returns {Promise<Object[]>} inserted rows (metadata only).
   * @throws {NotFoundError} when the problem does not exist.
   */
  async replaceAllTestCases(problemId, testCases = []) {
    return withTransaction(async (client) => {
      const problem = await this.problemRepository.findById(problemId, client);
      if (!problem) {
        throw new NotFoundError('Problem not found.');
      }

      await this.testCaseRepository.deleteAllTestCases(problemId, client);
      return this.testCaseRepository.createManyTestCases(problemId, testCases, client);
    });
  }

  /**
   * Create a single test case for a problem.
   *
   * @param {string} problemId
   * @param {Object} data - repository-shaped case data.
   * @returns {Promise<Object>}
   */
  async createTestCase(problemId, data) {
    const problem = await this.problemRepository.findById(problemId);
    if (!problem) {
      throw new NotFoundError('Problem not found.');
    }
    return this.testCaseRepository.createTestCase({ ...data, problemId });
  }

  /**
   * List all test cases for a problem (admin — includes hidden).
   *
   * @param {string} problemId
   * @returns {Promise<Object[]>}
   */
  async listTestCases(problemId) {
    const problem = await this.problemRepository.findById(problemId);
    if (!problem) {
      throw new NotFoundError('Problem not found.');
    }
    return this.testCaseRepository.listByProblemId(problemId);
  }

  /**
   * Fetch a single test case by id (admin — includes hidden payloads).
   *
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getTestCaseById(id) {
    const row = await this.testCaseRepository.findById(id);
    if (!row) {
      throw new NotFoundError('Test case not found.');
    }
    return row;
  }

  /**
   * Update a test case by id.
   *
   * @param {string} id
   * @param {Object} patch
   * @returns {Promise<Object>}
   */
  async updateTestCase(id, patch) {
    const existing = await this.testCaseRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Test case not found.');
    }
    const updated = await this.testCaseRepository.updateTestCase(id, patch);
    if (!updated) {
      throw new NotFoundError('Test case not found.');
    }
    return updated;
  }

  /**
   * Delete a test case by id.
   *
   * @param {string} id
   * @returns {Promise<{ id: string, deleted: true }>}
   */
  async deleteTestCase(id) {
    const deleted = await this.testCaseRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError('Test case not found.');
    }
    return { id: deleted.id, deleted: true };
  }

  /**
   * Load ALL test cases (public + hidden) for judging, in evaluation order.
   * Intended ONLY for the judge pipeline — returns hidden expected outputs.
   *
   * @param {string} problemId
   * @returns {Promise<Object[]>}
   */
  getJudgeTestCases(problemId) {
    return this.testCaseRepository.getTestCasesForJudge(problemId);
  }

  /**
   * Load ONLY public (non-hidden) sample examples, in order.
   *
   * @param {string} problemId
   * @returns {Promise<Object[]>}
   */
  getPublicExamples(problemId) {
    return this.testCaseRepository.getPublicExamples(problemId);
  }
}

module.exports = { TestCaseService, testCaseService: new TestCaseService() };
