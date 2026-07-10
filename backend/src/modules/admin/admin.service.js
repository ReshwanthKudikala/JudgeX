// Admin business logic: problem CRUD and test-case management.
//
// This is a thin COORDINATION layer over existing domain services — it owns no
// duplicated problem/test-case rules of its own. Problem persistence lives in
// ProblemService; test-case persistence/atomic replace lives in TestCaseService.
// The only admin-specific concern here is translating the admin API's payload
// (inline input/expected text) into the repository-shaped test-case records.

const { problemService } = require('../problems/problems.service');
const { testCaseService } = require('../problems/testcase.service');

// Map an admin-supplied inline case to the repository/test-case shape.
// (Small inline payloads only; external object storage is a later sprint.)
function toTestCaseRecord(testCase, index) {
  const input = testCase.input;
  const expectedOutput = testCase.expectedOutput;
  return {
    inputRef: input,
    expectedOutputRef: expectedOutput,
    isHidden: testCase.isHidden ?? true,
    isInline: true,
    sizeBytes: Buffer.byteLength(input, 'utf8') + Buffer.byteLength(expectedOutput, 'utf8'),
    checksum: null,
    displayOrder: testCase.displayOrder ?? index,
  };
}

class AdminService {
  constructor({ problemService: probSvc, testCaseService: tcSvc } = {}) {
    this.problemService = probSvc || problemService;
    this.testCaseService = tcSvc || testCaseService;
  }

  // Create a problem (delegates to ProblemService).
  createProblem(data) {
    return this.problemService.createProblem(data);
  }

  // Update a problem (delegates to ProblemService).
  updateProblem(id, data) {
    return this.problemService.updateProblem(id, data);
  }

  // Soft-delete a problem (delegates to ProblemService).
  deleteProblem(id) {
    return this.problemService.deleteProblem(id);
  }

  // Atomically replace a problem's entire test-case set (delegates to TestCaseService).
  replaceTestCases(problemId, testCases = []) {
    const records = testCases.map(toTestCaseRecord);
    return this.testCaseService.replaceAllTestCases(problemId, records);
  }
}

module.exports = { AdminService, adminService: new AdminService() };
