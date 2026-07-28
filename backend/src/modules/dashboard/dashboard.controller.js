// Thin HTTP adapter for the user dashboard.

const { dashboardService } = require('./dashboard.service');
const { sendSuccess } = require('../../shared/http/response');

// GET /dashboard → 200 authenticated user dashboard payload
async function getDashboard(req, res, next) {
  try {
    const dashboard = await dashboardService.getDashboard(req.user.id);
    sendSuccess(req, res, 200, dashboard);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
