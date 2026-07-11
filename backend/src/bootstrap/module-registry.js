// Registers module routers into the API app (single wiring point).
// New feature modules mount their routers here under the versioned API base.

const { authRoutes } = require('../modules/auth/auth.routes');
const { problemRoutes } = require('../modules/problems/problems.routes');
const { submissionRoutes } = require('../modules/submissions/submissions.routes');
const { adminRoutes } = require('../modules/admin/admin.routes');
const { leaderboardRoutes } = require('../modules/leaderboard/leaderboard.routes');
const { aiRoutes } = require('../modules/ai/ai.routes');

const API_BASE = '/api/v1';

function registerModules(app) {
  app.use(`${API_BASE}/auth`, authRoutes);
  app.use(`${API_BASE}/problems`, problemRoutes);
  app.use(`${API_BASE}/submissions`, submissionRoutes);
  app.use(`${API_BASE}/admin`, adminRoutes);
  app.use(`${API_BASE}/leaderboard`, leaderboardRoutes);
  app.use(`${API_BASE}/ai`, aiRoutes);
}

module.exports = { registerModules, API_BASE };
