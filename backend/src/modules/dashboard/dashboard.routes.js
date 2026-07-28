// Declares the authenticated user dashboard endpoint (Sprint 38).
// Mounted under /api/v1/dashboard by the module registry.

const { Router } = require('express');

const { authenticate } = require('../../middlewares/authenticate');
const controller = require('./dashboard.controller');

const router = Router();

router.get('/', authenticate, controller.getDashboard);

module.exports = { dashboardRoutes: router };
