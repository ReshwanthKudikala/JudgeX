// Declares AI assistant HTTP endpoints.
// Mounted under /api/v1/ai. Auth required; AI is a non-critical path.
// Sprint 47 — single AI Coach surface (legacy learning-assist routes removed).

const { Router } = require('express');

const { coachRoutes } = require('./coach.routes');

const router = Router();

router.use(coachRoutes);

module.exports = { aiRoutes: router };
