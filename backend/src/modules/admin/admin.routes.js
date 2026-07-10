// Declares admin problem-management HTTP endpoints and attaches middleware.
// Mounted under /api/v1/admin by the module registry.
//
// NOTE: authorization (RBAC/admin role) is NOT wired yet — deferred to a later
// sprint. The route chain intentionally leaves a slot where an `authorize`
// middleware will sit ahead of each handler.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const controller = require('./admin.controller');
const {
  createProblemSchema,
  updateProblemSchema,
  replaceTestCasesSchema,
} = require('./admin.validators');

const router = Router();

router.post('/problems', validate(createProblemSchema), controller.createProblem);
router.patch('/problems/:id', validate(updateProblemSchema), controller.updateProblem);
router.delete('/problems/:id', controller.deleteProblem);
router.put(
  '/problems/:id/testcases',
  validate(replaceTestCasesSchema),
  controller.replaceTestCases,
);

module.exports = { adminRoutes: router };
