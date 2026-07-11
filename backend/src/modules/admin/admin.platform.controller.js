const { adminPlatformService } = require('./admin.platform.service');
const { sendSuccess } = require('../../shared/http/response');

async function getOverview(req, res, next) {
  try {
    const data = await adminPlatformService.getOverview();
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { users, pagination } = await adminPlatformService.listUsers(req.query);
    sendSuccess(req, res, 200, users, { pagination });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const user = await adminPlatformService.suspendUser(req.params.id, req.user);
    sendSuccess(req, res, 200, user);
  } catch (err) {
    next(err);
  }
}

async function unsuspendUser(req, res, next) {
  try {
    const user = await adminPlatformService.unsuspendUser(req.params.id, req.user);
    sendSuccess(req, res, 200, user);
  } catch (err) {
    next(err);
  }
}

async function promoteAdmin(req, res, next) {
  try {
    const user = await adminPlatformService.promoteAdmin(req.params.id, req.user);
    sendSuccess(req, res, 200, user);
  } catch (err) {
    next(err);
  }
}

async function demoteAdmin(req, res, next) {
  try {
    const user = await adminPlatformService.demoteAdmin(req.params.id, req.user);
    sendSuccess(req, res, 200, user);
  } catch (err) {
    next(err);
  }
}

async function listModeration(req, res, next) {
  try {
    const data = await adminPlatformService.listModeration(req.query);
    sendSuccess(req, res, 200, data.items, {
      pagination: data.pagination,
      entityType: data.entityType,
    });
  } catch (err) {
    next(err);
  }
}

async function bulkModeration(req, res, next) {
  try {
    const result = await adminPlatformService.bulkModeration(req.body, req.user);
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

async function getQueueStatus(req, res, next) {
  try {
    const data = await adminPlatformService.getQueueStatus();
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function getMonitoring(req, res, next) {
  try {
    const data = await adminPlatformService.getMonitoring();
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function listFailedJobs(req, res, next) {
  try {
    const data = await adminPlatformService.listFailedJobs(req.query);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function retryFailedJobs(req, res, next) {
  try {
    const data = await adminPlatformService.retryFailedJobs(req.user);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function clearCompletedJobs(req, res, next) {
  try {
    const data = await adminPlatformService.clearCompletedJobs(req.user);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const data = await adminPlatformService.getAnalytics(req.query);
    sendSuccess(req, res, 200, data);
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { logs, pagination } = await adminPlatformService.listAuditLogs(req.query);
    sendSuccess(req, res, 200, logs, { pagination });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  listUsers,
  suspendUser,
  unsuspendUser,
  promoteAdmin,
  demoteAdmin,
  listModeration,
  bulkModeration,
  getQueueStatus,
  getMonitoring,
  listFailedJobs,
  retryFailedJobs,
  clearCompletedJobs,
  getAnalytics,
  listAuditLogs,
};
