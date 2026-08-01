/**
 * Learning Coach HTTP controller — POST /api/v1/ai/coach
 */

const { coachService } = require('./coach.service');
const { sendSuccess } = require('../../shared/http/response');
const { metrics } = require('../../shared/observability/metrics');

function wrapAi(endpoint, handler) {
  return async (req, res, next) => {
    const started = Date.now();
    const log = req.log || require('../../shared/logger/logger').logger;
    try {
      await handler(req, res);
      metrics.recordAiRequest(endpoint, 'ok');
      log.info('ai_request', {
        endpoint,
        userId: req.user?.id || null,
        durationMs: Date.now() - started,
        result: 'ok',
      });
    } catch (err) {
      metrics.recordAiRequest(endpoint, 'error');
      log.warn('ai_request', {
        endpoint,
        userId: req.user?.id || null,
        durationMs: Date.now() - started,
        result: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  };
}

async function coach(req, res) {
  const data = await coachService.coach(req.body, req.user.id);
  sendSuccess(req, res, 200, data);
}

module.exports = {
  coach: wrapAi('coach', coach),
};
