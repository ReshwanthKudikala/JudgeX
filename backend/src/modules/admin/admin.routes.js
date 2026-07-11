// Declares admin problem-management HTTP endpoints and attaches middleware.
// Mounted under /api/v1/admin by the module registry.
//
// Every admin route requires: authenticate → authorize('admin') → (validate) → controller.
// Controllers/services stay role-agnostic; RBAC lives entirely in this middleware chain.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const controller = require('./admin.controller');
const contestController = require('./admin.contests.controller');
const editorialController = require('./admin.editorials.controller');
const {
  createProblemSchema,
  updateProblemSchema,
  replaceTestCasesSchema,
  createTestCaseSchema,
  updateTestCaseSchema,
} = require('./admin.validators');
const {
  createContestSchema,
  updateContestSchema,
  contestIdParamsSchema,
} = require('../contests/contests.validators');
const {
  createEditorialSchema,
  updateEditorialSchema,
  problemIdParamsSchema,
  editorialIdParamsSchema,
} = require('../editorials/editorials.validators');

const router = Router();

// Shared gate for every admin route: prove identity, then require the admin role.
const requireAdmin = [authenticate, authorize('admin')];

router.post(
  '/problems',
  ...requireAdmin,
  validate(createProblemSchema),
  controller.createProblem,
);
router.patch(
  '/problems/:id',
  ...requireAdmin,
  validate(updateProblemSchema),
  controller.updateProblem,
);
router.delete('/problems/:id', ...requireAdmin, controller.deleteProblem);

// Existing replace-all contract (backwards compatible).
router.put(
  '/problems/:id/testcases',
  ...requireAdmin,
  validate(replaceTestCasesSchema),
  controller.replaceTestCases,
);

// Sprint 25 — per-case admin CRUD.
router.post(
  '/problems/:id/testcases',
  ...requireAdmin,
  validate(createTestCaseSchema),
  controller.createTestCase,
);
router.get('/problems/:id/testcases', ...requireAdmin, controller.listTestCases);
router.patch(
  '/testcases/:id',
  ...requireAdmin,
  validate(updateTestCaseSchema),
  controller.updateTestCase,
);
router.delete('/testcases/:id', ...requireAdmin, controller.deleteTestCase);

// Sprint 28 — contest admin CRUD.
router.post(
  '/contests',
  ...requireAdmin,
  validate(createContestSchema),
  contestController.createContest,
);
router.get(
  '/contests/:id',
  ...requireAdmin,
  validate(contestIdParamsSchema, 'params'),
  contestController.getContest,
);
router.patch(
  '/contests/:id',
  ...requireAdmin,
  validate(contestIdParamsSchema, 'params'),
  validate(updateContestSchema),
  contestController.updateContest,
);
router.delete(
  '/contests/:id',
  ...requireAdmin,
  validate(contestIdParamsSchema, 'params'),
  contestController.deleteContest,
);

// Sprint 29 — editorial admin CRUD.
router.post(
  '/problems/:problemId/editorial',
  ...requireAdmin,
  validate(problemIdParamsSchema, 'params'),
  validate(createEditorialSchema),
  editorialController.createEditorial,
);
router.get(
  '/editorials/:id',
  ...requireAdmin,
  validate(editorialIdParamsSchema, 'params'),
  editorialController.getEditorial,
);
router.patch(
  '/editorials/:id',
  ...requireAdmin,
  validate(editorialIdParamsSchema, 'params'),
  validate(updateEditorialSchema),
  editorialController.updateEditorial,
);
router.delete(
  '/editorials/:id',
  ...requireAdmin,
  validate(editorialIdParamsSchema, 'params'),
  editorialController.deleteEditorial,
);

module.exports = { adminRoutes: router };
