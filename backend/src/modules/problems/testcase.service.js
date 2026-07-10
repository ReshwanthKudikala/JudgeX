// Test case business logic: atomic replace, judge loading, public examples.
//
// Business logic only: no SQL, no Express/HTTP, no judging, no storage/object
// resolution. Persistence is delegated to TestCaseRepository; existence checks
// reuse ProblemRepository; multi-step atomicity uses the transaction manager.
//
// Visibility: hidden expected outputs are exposed ONLY via getJudgeTestCases()
// (judge-pipeline use); getPublicExamples() returns non-hidden samples only.

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

      // Old set removed and new set inserted as one unit of work: a problem is
      // never left with a partial or empty test-case set on failure.
      await this.testCaseRepository.deleteAllTestCases(problemId, client);
      return this.testCaseRepository.createManyTestCases(problemId, testCases, client);
    });
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
