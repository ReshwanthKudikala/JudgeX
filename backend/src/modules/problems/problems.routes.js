// Declares public problem browsing/detail/creation HTTP endpoints.
// Mounted under /api/v1/problems by the module registry.
//
// All endpoints are public for now. Admin authorization on POST (and future
// admin routes) is deliberately deferred to a later sprint.

const { Router } = require('express');

const { validate } = require('../../middlewares/validate');
const controller = require('./problems.controller');
const { listProblemsQuerySchema, createProblemSchema } = require('./problems.validators');

const router = Router();

router.get('/', validate(listProblemsQuerySchema, 'query'), controller.listProblems);
router.post('/', validate(createProblemSchema), controller.createProblem);
router.get('/id/:id', controller.getProblemById);
router.get('/:slug', controller.getProblemBySlug);

module.exports = { problemRoutes: router };
