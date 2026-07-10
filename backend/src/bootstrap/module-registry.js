// Registers module routers into the API app (single wiring point).
// New feature modules mount their routers here under the versioned API base.

const { authRoutes } = require('../modules/auth/auth.routes');
const { problemRoutes } = require('../modules/problems/problems.routes');

const API_BASE = '/api/v1';

function registerModules(app) {
  app.use(`${API_BASE}/auth`, authRoutes);
  app.use(`${API_BASE}/problems`, problemRoutes);
  // Future: submissions, leaderboard, admin, ai mount here.
}

module.exports = { registerModules, API_BASE };
