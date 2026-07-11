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
const {
  createProblemSchema,
  updateProblemSchema,
  replaceTestCasesSchema,
} = require('./admin.validators');

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
router.put(
  '/problems/:id/testcases',
  ...requireAdmin,
  validate(replaceTestCasesSchema),
  controller.replaceTestCases,
);

module.exports = { adminRoutes: router };
