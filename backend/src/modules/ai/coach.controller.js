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
  const log = req.log || require('../../shared/logger/logger').logger;
  log.info('ai_coach_timing', {
    userId: req.user?.id || null,
    durationMs: data.durationMs,
    loadMs: data.loadMs ?? null,
    promptEvalMs: data.promptEvalMs ?? null,
    evalMs: data.evalMs ?? null,
    promptTokens: data.promptTokens ?? null,
    outputTokens: data.outputTokens ?? null,
    verification: data.verification ?? null,
  });
  sendSuccess(req, res, 200, data);
}

async function coachStream(req, res) {
  const started = Date.now();
  const log = req.log || require('../../shared/logger/logger').logger;
  const abort = new AbortController();
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const onClose = () => {
    if (!res.writableEnded) abort.abort();
  };
  res.on('close', onClose);

  /** @type {object} */
  let timing = {};
  let result = 'ok';
  const write = (event, data) => {
    if (res.writableEnded) return;
    if (event === 'done') {
      timing = {
        incomplete: Boolean(data.incomplete),
        durationMs: data.durationMs ?? null,
        loadMs: data.loadMs ?? null,
        promptEvalMs: data.promptEvalMs ?? null,
        evalMs: data.evalMs ?? null,
        promptTokens: data.promptTokens ?? null,
        outputTokens: data.outputTokens ?? null,
        verification: data.verification ?? null,
      };
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await coachService.coachStream(req.body, req.user.id, {
      signal: abort.signal,
      write,
    });
    metrics.recordAiRequest('coach_stream', 'ok');
  } catch (err) {
    result = 'error';
    metrics.recordAiRequest('coach_stream', 'error');
    const message = err instanceof Error ? err.message : 'The coach request failed.';
    write('error', { message: message.slice(0, 300) });
  } finally {
    res.off('close', onClose);
    log.info('ai_request', {
      endpoint: 'coach_stream',
      userId: req.user?.id || null,
      durationMs: Date.now() - started,
      result,
      ...timing,
    });
    if (!res.writableEnded) res.end();
  }
}

module.exports = {
  coach: wrapAi('coach', coach),
  coachStream,
};
