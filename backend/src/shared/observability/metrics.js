// Prometheus metrics registry (prom-client). Scraped at GET /metrics.

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'judgex_' });

const httpRequestsTotal = new client.Counter({
  name: 'judgex_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'judgex_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const submissionsCreatedTotal = new client.Counter({
  name: 'judgex_submissions_created_total',
  help: 'Submissions created',
  labelNames: ['language'],
  registers: [register],
});

const judgeDurationSeconds = new client.Histogram({
  name: 'judgex_judge_duration_seconds',
  help: 'End-to-end judge job duration in seconds',
  labelNames: ['verdict'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const judgeJobsTotal = new client.Counter({
  name: 'judgex_judge_jobs_total',
  help: 'Judge jobs completed or failed',
  labelNames: ['result'],
  registers: [register],
});

const queueDepth = new client.Gauge({
  name: 'judgex_queue_depth',
  help: 'BullMQ job counts by state',
  labelNames: ['state'],
  registers: [register],
});

const aiRequestsTotal = new client.Counter({
  name: 'judgex_ai_requests_total',
  help: 'AI assistant requests',
  labelNames: ['endpoint', 'result'],
  registers: [register],
});

const contestJoinsTotal = new client.Counter({
  name: 'judgex_contest_joins_total',
  help: 'Contest join attempts',
  labelNames: ['result'],
  registers: [register],
});

const errorsTotal = new client.Counter({
  name: 'judgex_errors_total',
  help: 'Tracked application errors',
  labelNames: ['source'],
  registers: [register],
});

const metrics = {
  observeHttpRequest({ method, route, statusCode, durationSeconds }) {
    const labels = {
      method,
      route: String(route).slice(0, 120),
      status_code: String(statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  },

  recordSubmissionCreated(language) {
    submissionsCreatedTotal.inc({ language: language || 'unknown' });
  },

  recordJudgeDuration(verdict, durationSeconds) {
    judgeDurationSeconds.observe({ verdict: verdict || 'unknown' }, durationSeconds);
  },

  recordJudgeJob(result) {
    judgeJobsTotal.inc({ result: result || 'unknown' });
  },

  setQueueDepth(counts = {}) {
    for (const [state, value] of Object.entries(counts)) {
      queueDepth.set({ state }, Number(value) || 0);
    }
  },

  recordAiRequest(endpoint, result) {
    aiRequestsTotal.inc({ endpoint: endpoint || 'unknown', result: result || 'ok' });
  },

  recordContestJoin(result) {
    contestJoinsTotal.inc({ result: result || 'ok' });
  },

  recordError(source) {
    errorsTotal.inc({ source: source || 'unknown' });
  },

  async render() {
    return register.metrics();
  },

  contentType: register.contentType,
};

module.exports = { metrics, register };
